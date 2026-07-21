import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as https from 'https';
import { PrismaService } from '../prisma/prisma.service';
import { Profile } from '@clickbit/shared';
import { buildLegacyDataEnvelope, buildLegacyMessageEnvelope } from './hr-utils';
import { CacheService } from '../redis/cache.service';

function parseDateOnly(value?: string | Date | null): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return isNaN(value.getTime()) ? undefined : value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

@Injectable()
export class PublicHolidaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache?: CacheService,
  ) {}

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('public-holidays', ...parts) ?? `public-holidays:${parts.filter((p) => p !== undefined && p !== null).join(':')}`;
  }

  private async invalidateCache(): Promise<void> {
    await this.cache?.delPrefix(this.cacheKey());
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    return this.cache?.getOrSet(key, factory, this.CACHE_TTL_SECONDS) ?? factory();
  }

  private isAdminOrManager(user: Profile) {
    return user.role === 'admin' || user.role === 'manager';
  }

  async findAll(query: { start_date?: string; end_date?: string; year?: string; country?: string }, user: Profile) {
    return this.cached(this.cacheKey('list', user.id, JSON.stringify(query)), async () => {
    const year = query.year ? Number(query.year) : new Date().getFullYear();
    const where: Prisma.hr_public_holidaysWhereInput = {
      holiday_date: {
        gte: parseDateOnly(`${year}-01-01`) || undefined,
        lte: parseDateOnly(`${year}-12-31`) || undefined,
      },
    };

    if (query.start_date && query.end_date) {
      where.holiday_date = { gte: parseDateOnly(query.start_date), lte: parseDateOnly(query.end_date) };
    }

    if (!this.isAdminOrManager(user)) {
      const employee = await this.prisma.employees.findFirst({ where: { user_id: user.id, deleted_at: null } });
      const empCountry = (employee?.country ? String(employee.country).trim() : '') || 'Australia';
      where.OR = [
        { location: { in: [empCountry, 'Both', 'Global'] } },
        { location: null },
      ];
    } else if (query.country) {
      where.location = { in: [query.country, 'Both', 'Global'] };
    }

    const holidays = await this.prisma.hr_public_holidays.findMany({ where, orderBy: { holiday_date: 'asc' } });
    return { success: true, data: holidays, count: holidays.length };
    });
  }

  async create(dto: Record<string, unknown>, user: Profile) {
    const data: Prisma.hr_public_holidaysUncheckedCreateInput = {
      name: dto.name as string,
      holiday_date: parseDateOnly(dto.holiday_date as string)!,
      location: (dto.location as string) || 'Australia',
      is_recurring: dto.is_recurring !== undefined ? Boolean(dto.is_recurring) : false,
      notes: (dto.notes as string) || null,
      created_by: user.id,
      created_at: new Date(),
      updated_at: new Date(),
    };
    const created = await this.prisma.hr_public_holidays.create({ data });
    await this.invalidateCache();
    return buildLegacyDataEnvelope(created);
  }

  async update(id: number, dto: Record<string, unknown>, _user: Profile) {
    await this.findOne(id);
    const data: Prisma.hr_public_holidaysUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name as string;
    if (dto.holiday_date !== undefined) data.holiday_date = parseDateOnly(dto.holiday_date as string);
    if (dto.location !== undefined) data.location = (dto.location) || null;
    if (dto.is_recurring !== undefined) data.is_recurring = Boolean(dto.is_recurring);
    if (dto.notes !== undefined) data.notes = (dto.notes) || null;
    data.updated_at = new Date();

    const updated = await this.prisma.hr_public_holidays.update({ where: { id }, data });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return buildLegacyDataEnvelope(updated);
  }

  async remove(id: number, _user: Profile) {
    await this.findOne(id);
    await this.prisma.hr_public_holidays.delete({ where: { id } });
    await this.invalidateCache();
    await this.cache?.del(this.cacheKey('detail', id));
    return buildLegacyMessageEnvelope('Holiday deleted');
  }

  async import(dto: { year?: number; countryCode?: string }, user: Profile) {
    const targetYear = dto.year || new Date().getFullYear();
    const targetCountryCode = (dto.countryCode as string) || 'AU';
    const locationName = targetCountryCode === 'AU' ? 'Australia' : targetCountryCode === 'BD' ? 'Bangladesh' : 'Australia';

    const holidays = await this.fetchHolidays(targetYear, targetCountryCode);
    let imported = 0;
    for (const h of holidays) {
      const existing = await this.prisma.hr_public_holidays.findFirst({
        where: {
          holiday_date: new Date(h.date),
          name: h.name,
          location: { in: [locationName, 'Both', 'Global'] },
        },
      });
      if (!existing && (h.global || targetCountryCode === 'AU')) {
        await this.prisma.hr_public_holidays.create({
          data: {
            name: h.name,
            holiday_date: new Date(h.date),
            location: locationName,
            is_recurring: false,
            notes: h.global ? 'Auto-imported from public API' : 'Auto-imported regional holiday',
            created_by: user.id,
            created_at: new Date(),
            updated_at: new Date(),
          },
        });
        imported++;
      }
    }

    await this.invalidateCache();
    return buildLegacyMessageEnvelope(`Successfully imported ${imported} holidays for ${locationName}.`);
  }

  async findOne(id: number) {
    return this.cached(this.cacheKey('detail', id), async () => {
    const holiday = await this.prisma.hr_public_holidays.findUnique({ where: { id } });
    if (!holiday) throw new NotFoundException({ success: false, message: 'Holiday not found' });
    return buildLegacyDataEnvelope(holiday);
    });
  }

  private fetchHolidays(year: number, countryCode: string): Promise<Array<{ date: string; name: string; global: boolean }>> {
    return new Promise((resolve, reject) => {
      const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`;
      https
        .get(url, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              resolve(Array.isArray(json) ? json : []);
            } catch (e) {
              reject(new Error(String(e)));
            }
          });
        })
        .on('error', (err) => reject(new Error(String(err))));
    });
  }
}
