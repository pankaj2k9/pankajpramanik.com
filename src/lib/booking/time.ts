/**
 * Timezone arithmetic on top of Intl only (no date library). Works in the
 * browser and on the server, so the booking page and the API agree exactly.
 *
 * A "date key" is a calendar day written YYYY-MM-DD; a "wall time" is HH:mm.
 * Both only mean something together with an IANA timezone. Instants are Date
 * objects (UTC).
 */

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string) {
  let f = partsFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatters.set(timeZone, f);
  }
  return f;
}

export type ZonedParts = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(timeZone).formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour === 24 ? 0 : out.hour,
    minute: out.minute,
    second: out.second,
  };
}

/** Offset of `timeZone` from UTC at `date`, in milliseconds (east positive). */
export function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * The instant at which the wall clock in `timeZone` reads the given local
 * date and time. Across a DST change the offset is re-evaluated at the
 * resulting instant. Local times skipped by a spring-forward gap resolve to
 * the instant just after the gap (like most calendar apps); ambiguous
 * fall-back times resolve to the first occurrence.
 */
export function zonedTimeToUtc(dateKey: string, wallTime: string, timeZone: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = wallTime.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - timeZoneOffsetMs(new Date(guess), timeZone);
  const second = guess - timeZoneOffsetMs(new Date(first), timeZone);
  if (first === second) return new Date(first);
  // Two candidates: the offset changed between them. Prefer the earlier one
  // if it really shows the requested wall time; otherwise we are in a gap.
  const earlier = Math.min(first, second);
  const p = zonedParts(new Date(earlier), timeZone);
  if (p.hour === hh && p.minute === mm) return new Date(earlier);
  return new Date(Math.max(first, second));
}

/** Calendar day (YYYY-MM-DD) of `date` in `timeZone`. */
export function dateKeyInZone(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Wall time (HH:mm) of `date` in `timeZone`. */
export function wallTimeInZone(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 0 = Sunday … 6 = Saturday for a calendar day (timezone independent). */
export function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Start of the calendar day in `timeZone`, as an instant. */
export function startOfDayUtc(dateKey: string, timeZone: string): Date {
  return zonedTimeToUtc(dateKey, "00:00", timeZone);
}

export function minutesOf(wallTime: string): number {
  const [h, m] = wallTime.split(":").map(Number);
  return h * 60 + m;
}

export function wallTimeFromMinutes(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone || timeZone.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export const WALL_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const DATE_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function listTimeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  const zones = intl.supportedValuesOf?.("timeZone") ?? [];
  return zones.includes("UTC") ? zones : ["UTC", ...zones];
}

/** "GMT-04:00" style label for a timezone at a given instant. */
export function offsetLabel(timeZone: string, at = new Date()): string {
  const minutes = Math.round(timeZoneOffsetMs(at, timeZone) / 60000);
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `GMT${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export function formatInZone(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
  locale = "en-US",
): string {
  return new Intl.DateTimeFormat(locale, { timeZone, ...options }).format(date);
}

export const formatTime = (date: Date, timeZone: string) =>
  formatInZone(date, timeZone, { hour: "numeric", minute: "2-digit" });

export const formatLongDate = (date: Date, timeZone: string) =>
  formatInZone(date, timeZone, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

function pad(n: number) {
  return String(n).padStart(2, "0");
}
