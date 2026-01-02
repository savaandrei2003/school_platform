export function parseISODateOnly(dateStr: string): Date {
  // dateStr: "2026-01-04" -> Date UTC midnight
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date');
  return d;
}

export function isSameDayUTC(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/**
 * Cutoff: 09:00 local time (Romania) - pentru proiect simplificăm:
 * folosim timpul serverului (containerului). Dacă vrei strict RO timezone,
 * punem TZ în container și e OK.
 */
export function isAfterCutoffForDate(targetDate: Date, now = new Date()): boolean {
  // dacă targetDate != azi => nu aplicăm cutoff
  if (!isSameDayUTC(targetDate, now)) return false;

  // cutoff 09:00 (ora locală a containerului)
  const cutoff = new Date(now);
  cutoff.setHours(9, 0, 0, 0);

  return now.getTime() > cutoff.getTime();
}
