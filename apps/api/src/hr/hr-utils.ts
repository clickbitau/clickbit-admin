import { Response } from 'express';
import { Prisma } from '@prisma/client';

export function setNoCache(res: Response): void {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
}

export function buildLegacyPagination(total: number, page: number, limit: number) {
  return {
    total,
    page,
    pages: total > 0 ? Math.ceil(total / limit) : 1,
    limit,
  };
}

export function buildLegacyListEnvelope<T>(items: T[], total: number, page: number, limit: number) {
  return {
    success: true,
    data: items,
    pagination: buildLegacyPagination(total, page, limit),
  };
}

export function buildLegacyDataEnvelope<T>(data: T) {
  return { success: true, data };
}

export function buildLegacyMessageEnvelope(message: string, data?: unknown) {
  const envelope: Record<string, unknown> = { success: true, message };
  if (data !== undefined) envelope.data = data;
  return envelope;
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

export function toNumber(value: unknown): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value) || 0;
  if (typeof value === 'object' && value !== null && typeof (value as { toNumber: () => number }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber() || 0;
  }
  return 0;
}

export function safeDate(value?: string | Date | null): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

export function asJsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}
