/**
 * Calendar-day helpers. Everything here works in UTC and speaks
 * 'YYYY-MM-DD', because a packing date and an expiry are days, not instants.
 */

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
