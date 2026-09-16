import {
  addDays,
  dateKeyInZone,
  startOfDayUtc,
  weekdayOf,
  zonedTimeToUtc,
} from "./time";

/**
 * Pure slot engine. The same function lists slots for the booking page and
 * re-validates a single slot inside the booking transaction, so the two can
 * never disagree about what is bookable.
 */

export type Interval = { start: number; end: number }; // epoch ms, end exclusive

export type AvailabilityInput = {
  timezone: string;
  minNoticeMinutes: number;
  maxDaysAhead: number;
  slotIntervalMinutes: number;
  maxPerDay: number;
  rules: { weekday: number; startTime: string; endTime: string }[];
  breaks: { weekday: number | null; startTime: string; endTime: string }[];
  blocked: Interval[];
  /** Existing active bookings with their own buffers already applied. */
  busyBookings: (Interval & { dayKey: string })[];
  /** Busy periods from connected calendars (already padded if needed). */
  externalBusy: Interval[];
  meeting: { durationMinutes: number; bufferBeforeMinutes: number; bufferAfterMinutes: number };
};

const MINUTE = 60_000;

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

export function effectiveBuffers(
  settings: { bufferBeforeMinutes: number; bufferAfterMinutes: number },
  meeting: { bufferBeforeMinutes: number; bufferAfterMinutes: number },
) {
  return {
    bufferBeforeMinutes: Math.max(settings.bufferBeforeMinutes, meeting.bufferBeforeMinutes),
    bufferAfterMinutes: Math.max(settings.bufferAfterMinutes, meeting.bufferAfterMinutes),
  };
}

/** The interval a booking occupies on the calendar, buffers included. */
export function occupiedInterval(
  startMs: number,
  endMs: number,
  bufferBeforeMinutes: number,
  bufferAfterMinutes: number,
): Interval {
  return { start: startMs - bufferBeforeMinutes * MINUTE, end: endMs + bufferAfterMinutes * MINUTE };
}

/**
 * All bookable start instants within [rangeStart, rangeEnd).
 * `now` is injectable for tests.
 */
export function computeSlots(
  input: AvailabilityInput,
  rangeStart: Date,
  rangeEnd: Date,
  now = new Date(),
): Date[] {
  const tz = input.timezone;
  const interval = Math.max(5, input.slotIntervalMinutes) * MINUTE;
  const duration = input.meeting.durationMinutes * MINUTE;
  const earliest = now.getTime() + input.minNoticeMinutes * MINUTE;
  const todayKey = dateKeyInZone(now, tz);
  const latest = startOfDayUtc(addDays(todayKey, input.maxDaysAhead + 1), tz).getTime();

  const from = Math.max(rangeStart.getTime(), earliest);
  const to = Math.min(rangeEnd.getTime(), latest);
  if (from >= to) return [];

  const perDay = new Map<string, number>();
  for (const b of input.busyBookings) perDay.set(b.dayKey, (perDay.get(b.dayKey) ?? 0) + 1);

  const slots: Date[] = [];
  // Walk calendar days in the booking timezone, one day either side of the
  // range so windows that cross midnight in other zones are included.
  let day = addDays(dateKeyInZone(new Date(from), tz), -1);
  const lastDay = addDays(dateKeyInZone(new Date(to), tz), 1);
  for (let guard = 0; day <= lastDay && guard < 400; guard++, day = addDays(day, 1)) {
    if (input.maxPerDay > 0 && (perDay.get(day) ?? 0) >= input.maxPerDay) continue;
    const weekday = weekdayOf(day);
    const dayBreaks = input.breaks
      .filter((b) => b.weekday === null || b.weekday === weekday)
      .map((b) => ({
        start: zonedTimeToUtc(day, b.startTime, tz).getTime(),
        end: zonedTimeToUtc(day, b.endTime, tz).getTime(),
      }));

    for (const rule of input.rules) {
      if (rule.weekday !== weekday) continue;
      const windowStart = zonedTimeToUtc(day, rule.startTime, tz).getTime();
      const windowEnd =
        rule.endTime === "00:00" || rule.endTime <= rule.startTime
          ? startOfDayUtc(addDays(day, 1), tz).getTime()
          : zonedTimeToUtc(day, rule.endTime, tz).getTime();

      for (let start = windowStart; start + duration <= windowEnd; start += interval) {
        if (start < from || start >= to) continue;
        const meeting = { start, end: start + duration };
        const occupied = occupiedInterval(
          meeting.start,
          meeting.end,
          input.meeting.bufferBeforeMinutes,
          input.meeting.bufferAfterMinutes,
        );
        if (dayBreaks.some((b) => overlaps(meeting, b))) continue;
        if (input.blocked.some((b) => overlaps(occupied, b))) continue;
        if (input.busyBookings.some((b) => overlaps(occupied, b))) continue;
        if (input.externalBusy.some((b) => overlaps(meeting, b))) continue;
        slots.push(new Date(start));
      }
    }
  }
  slots.sort((a, b) => a.getTime() - b.getTime());
  return slots.filter((s, i) => i === 0 || s.getTime() !== slots[i - 1].getTime());
}

/** True when `start` is exactly one of the bookable slots. */
export function isSlotBookable(input: AvailabilityInput, start: Date, now = new Date()): boolean {
  const s = start.getTime();
  return computeSlots(input, new Date(s), new Date(s + MINUTE), now).some((d) => d.getTime() === s);
}
