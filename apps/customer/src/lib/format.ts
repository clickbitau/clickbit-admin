export function formatCurrency(value: number | string | undefined, currency = 'AUD'): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num === undefined || value === '' || Number.isNaN(num)) return '-';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDate(value: string | Date | undefined | null): string {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | Date | undefined | null): string {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).replace(' am', ' AM').replace(' pm', ' PM');
}

export function getInitials(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function daysUntil(value: string | Date | undefined | null): string {
  if (!value) return '-';
  const target = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(target.getTime())) return '-';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  return `${diff}d`;
}

export function formatDistanceToNow(value: string | Date | undefined | null): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(value);
}

export function formatDuration(totalSeconds?: number | null): string {
  if (totalSeconds === undefined || totalSeconds === null || Number.isNaN(totalSeconds) || totalSeconds <= 0) return '';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

export function formatLeaveHours(value: number | string | null | undefined): string {
  if (value === undefined || value === null || value === '') return '0.0 hrs';
  const num = typeof value === 'string' ? parseFloat(value) : typeof value === 'number' ? value : NaN;
  if (Number.isNaN(num)) return '0.0 hrs';
  return `${num.toFixed(1)} hrs`;
}
