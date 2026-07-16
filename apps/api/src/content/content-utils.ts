import { Prisma } from '@prisma/client';

export const profileSelect: Prisma.profilesSelect = {
  id: true,
  first_name: true,
  last_name: true,
  email: true,
  avatar: true,
};

export function stringValue(value: unknown, defaultValue = ''): string {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
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

export function booleanValue(value: unknown, defaultValue = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true' || value === '1';
  return defaultValue;
}

export function asJson<T>(value: unknown, defaultValue: T): any {
  if (value === undefined || value === null) return defaultValue as any;
  return value as any;
}

export function parseJson(value: unknown, defaultValue: any): any {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value as string);
  } catch {
    return defaultValue;
  }
}

export function buildDataEnvelope<T>(data: T) {
  return { success: true, data };
}

export function buildMessageEnvelope(message: string, data?: unknown) {
  return data !== undefined ? { success: true, message, data } : { success: true, message };
}

export function buildListEnvelope<T>(data: T[], total: number, limit?: number, offset?: number) {
  return { success: true, data, pagination: { total, limit: limit || data.length, offset: offset || 0, hasMore: (offset || 0) + data.length < total } };
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}
