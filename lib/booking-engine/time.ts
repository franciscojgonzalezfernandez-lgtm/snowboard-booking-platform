const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseHHMM(hhmm: string): number {
  const m = HHMM_RE.exec(hhmm);
  if (!m) throw new Error(`Invalid HH:MM time: "${hhmm}"`);
  return Number(m[1]) * 60 + Number(m[2]);
}

export function formatHHMM(minutes: number): string {
  if (minutes < 0 || minutes >= 24 * 60) {
    throw new Error(`Minutes out of day range: ${minutes}`);
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function startOfUtcDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function setUtcTime(base: Date, hhmm: string): Date {
  const minutes = parseHHMM(hhmm);
  const out = new Date(base);
  out.setUTCHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return out;
}

export function diffMinutes(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 60000);
}

export function sameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export function toIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The single timezone all booking wall-clocks are expressed in (Swiss school). */
export const BOOKING_TIME_ZONE = "Europe/Zurich";

/** Offset in ms of `timeZone` at the given absolute instant (local − UTC). */
function tzOffsetMs(timeZone: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const part of dtf.formatToParts(at)) parts[part.type] = part.value;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - at.getTime();
}

/**
 * Convert a naive Europe/Zurich wall-clock — the kind {@link setUtcTime} stamps
 * into a Date's UTC accessors (e.g. `12:00:00Z` *meaning* 12:00 Zurich) — into
 * the true UTC instant. DST-aware: subtracts the zone's offset at that wall
 * time (two-pass to settle the offset across a DST boundary).
 *
 * Use ONLY at boundaries that emit an absolute time to an external calendar
 * (the .ics `DTSTART`). Without it, 12:00 Zurich was written as 12:00 UTC and
 * rendered an hour late (13:00 in winter) in every mail-client calendar.
 */
export function zurichWallClockToUtc(wallClockAsUtc: Date): Date {
  const naiveMs = wallClockAsUtc.getTime();
  const off1 = tzOffsetMs(BOOKING_TIME_ZONE, new Date(naiveMs));
  let utcMs = naiveMs - off1;
  const off2 = tzOffsetMs(BOOKING_TIME_ZONE, new Date(utcMs));
  if (off2 !== off1) utcMs = naiveMs - off2;
  return new Date(utcMs);
}
