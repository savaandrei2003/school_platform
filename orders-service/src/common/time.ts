// src/common/time.ts

export function parseISODateOnly(dateStr: string): Date {
  // dateStr: "2026-01-04" -> Date UTC midnight
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
  return d;
}

// Normalizează "azi" ca date-only (UTC) ca să compari corect cu parseISODateOnly
export function todayDateOnlyUTC(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function isPastDateUTC(targetDate: Date, now = new Date()): boolean {
  const t = Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate());
  const n = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return t < n;
}

export function isSameDayUTC(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/**
 * LOCK RULES:
 * - trecut -> LOCK
 * - azi după 09:00 -> LOCK
 * - viitor -> OK
 */

function getCutoffHM() {
  const raw = process.env.ORDER_CUTOFF_TIME ?? '09:00:00';
  const [h, m] = raw.split(':').map(Number);
  return { h: h ?? 9, m: m ?? 0 };
}


// export function isOrderLockedForDate(targetDate: Date, now = new Date()): boolean {
//   if (isPastDateUTC(targetDate, now)) return true;

//   if (isSameDayUTC(targetDate, now)) {
//     const cutoff = new Date(now);
//     cutoff.setHours(9, 0, 0, 0);
//     return now.getTime() > cutoff.getTime();
//   }

//   return false;
// }

export function isOrderLockedForDate(targetDate: Date, now = new Date()): boolean {
  if (isPastDateUTC(targetDate, now)) return true;

  if (isSameDayUTC(targetDate, now)) {
    const { h, m } = getCutoffHM();
    const cutoff = new Date(now);
    cutoff.setHours(h, m, 0, 0);
    return now.getTime() > cutoff.getTime();
  }

  return false;
}