import { Prisma } from '@prisma/client';

export function buildLegacyListEnvelope<T>(data: T[], total: number, page: number, limit: number) {
  return {
    success: true,
    data,
    pagination: { total, page, pages: Math.ceil(total / limit) || 1, limit },
  };
}

export function buildLegacyDataEnvelope<T>(data: T) {
  return { success: true, data };
}

export function buildLegacyMessageEnvelope<T>(message: string, data?: T) {
  return data !== undefined ? { success: true, message, data } : { success: true, message };
}

export function buildAdminListEnvelope<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): { tickets: T[]; pagination: { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number } } {
  return {
    tickets: data,
    pagination: { currentPage: page, totalPages: Math.ceil(total / limit) || 1, totalItems: total, itemsPerPage: limit },
  };
}

export function stringValue(value: unknown, defaultValue = ''): string {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  return defaultValue;
}

export function numberValue(value: unknown, defaultValue = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : defaultValue;
  }
  return defaultValue;
}

export function parseNumber(value: unknown): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value) || 0;
  if (typeof value === 'object' && value !== null && typeof (value as { toNumber: () => number }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber() || 0;
  }
  return 0;
}

export function asJsonInput<T>(value: unknown, defaultValue: T): any {
  if (value === undefined || value === null) return defaultValue;
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return value;
  return defaultValue;
}

export function safeDate(value?: string | Date | null): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return isNaN(value.getTime()) ? undefined : value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

export function parseDateOnly(value?: string | Date | null): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return isNaN(value.getTime()) ? undefined : value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

export function setNoCache(res: { set: (key: string, value: string) => void }) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

export function escapeLike(value: string): string {
  return value.replace(/[%_]/g, '\\$&');
}

export async function generateTicketNumber(prisma: { tickets: { count: (args: { where: Prisma.ticketsWhereInput }) => Promise<number> } }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const prefix = `TKT-${year}${month}${day}-`;
  const count = await prisma.tickets.count({ where: { ticket_number: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(5, '0')}`;
}
