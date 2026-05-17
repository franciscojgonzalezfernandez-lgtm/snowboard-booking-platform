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
