export function formatDate(date: unknown): string {
  if (!date) return 'Invalid Date';
  const d = typeof date === 'string' ? new Date(date) : (date as Date);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return 'Invalid Date';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

export function formatDateLong(date: unknown): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : (date as Date);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
}
