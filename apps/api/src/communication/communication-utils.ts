import { Prisma } from '@prisma/client';

export const profileSelect: Prisma.profilesSelect = {
  id: true,
  first_name: true,
  last_name: true,
  email: true,
  avatar: true,
  role: true,
};

export function buildDataEnvelope<T>(data: T) {
  return { success: true, data };
}

export function buildMessageEnvelope(message: string, data?: unknown) {
  return data !== undefined ? { success: true, message, data } : { success: true, message };
}

export function buildListEnvelope<T>(data: T[], count: number, limit = 50, offset = 0) {
  return { success: true, data, pagination: { count, limit, offset } };
}

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

export function asJsonInput<T>(value: unknown, defaultValue: T): any {
  if (value === undefined || value === null) return defaultValue as any;
  return value as any;
}
