import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getBookingSettings } from "@/lib/booking/service";
import { durationLabel, LOCATION_LABELS, STATUS_LABELS } from "@/lib/booking/labels";
import {
  addDays,
  DATE_KEY_RE,
  dateKeyInZone,
  formatInZone,
  formatTime,
  minutesOf,
  startOfDayUtc,
  weekdayOf,
  zonedTimeToUtc,
} from "@/lib/booking/time";
import AdminCalendar, { type CalendarEvent, type CalendarView } from "@/components/admin/booking/AdminCalendar";

const DAY_MINUTES = 24 * 60;

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const settings = await getBookingSettings();
  const tz = settings.timezone;
  const now = new Date();
  const today = dateKeyInZone(now, tz);
  const view: CalendarView = sp.view === "week" || sp.view === "day" ? sp.view : "month";
  const date = sp.date && DATE_KEY_RE.test(sp.date) ? sp.date : today;

  // Visible days (Monday-first weeks).
  const mondayOf = (key: string) => addDays(key, -((weekdayOf(key) + 6) % 7));
  let days: string[];
  if (view === "day") days = [date];
  else if (view === "week") days = Array.from({ length: 7 }, (_, i) => addDays(mondayOf(date), i));
  else {
    const first = `${date.slice(0, 7)}-01`;
    const start = mondayOf(first);
    const nextMonth = addDays(`${date.slice(0, 7)}-28`, 5).slice(0, 7);
    const last = addDays(`${nextMonth}-01`, -1);
    const end = addDays(mondayOf(last), 6);
    days = [];
    for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  }
  const rangeStart = startOfDayUtc(days[0], tz);
  const rangeEnd = startOfDayUtc(addDays(days[days.length - 1], 1), tz);

  const [bookings, blocks, rules, breaks] = await Promise.all([
    prisma.booking.findMany({
      where: { startTimeUTC: { lt: rangeEnd }, endTimeUTC: { gt: rangeStart }, status: { not: "RESCHEDULED" } },
      include: { meetingType: true },
      orderBy: { startTimeUTC: "asc" },
    }),
    prisma.blockedTime.findMany({ where: { startTimeUTC: { lt: rangeEnd }, endTimeUTC: { gt: rangeStart } } }),
    prisma.availabilityRule.findMany({ where: { active: true } }),
    prisma.availabilityBreak.findMany(),
  ]);

  const dayBounds = new Map(days.map((d) => [d, { start: startOfDayUtc(d, tz).getTime(), end: startOfDayUtc(addDays(d, 1), tz).getTime() }]));
  const minuteIn = (d: string, t: number) => {
    const b = dayBounds.get(d)!;
    // Minutes on the wall clock; DST days are 23/25 h long, so scale to 24 h.
    return Math.round(((t - b.start) / (b.end - b.start)) * DAY_MINUTES);
  };

  const events: CalendarEvent[] = [];
  for (const b of bookings) {
    const d = dateKeyInZone(b.startTimeUTC, tz);
    if (!dayBounds.has(d)) continue;
    const minutes = Math.round((b.endTimeUTC.getTime() - b.startTimeUTC.getTime()) / 60000);
    events.push({
      id: b.id,
      kind: "booking",
      dayKey: d,
      startMin: minuteIn(d, b.startTimeUTC.getTime()),
      endMin: Math.min(DAY_MINUTES, minuteIn(d, b.endTimeUTC.getTime())),
      label: `${formatTime(b.startTimeUTC, tz)} ${b.fullName}`,
      status: b.status.toLowerCase(),
      rawStatus: b.status,
      upcoming: b.startTimeUTC > now,
      rows: [
        ["Status", STATUS_LABELS[b.status]],
        ["When", `${formatInZone(b.startTimeUTC, tz, { weekday: "long", month: "long", day: "numeric" })}, ${formatTime(b.startTimeUTC, tz)} - ${formatTime(b.endTimeUTC, tz)}`],
        ["Attendee time", `${formatTime(b.startTimeUTC, b.visitorTimezone)} (${b.visitorTimezone})`],
        ["Meeting", `${b.meetingType.name} · ${durationLabel(minutes)}`],
        ["Method", b.meetingUrl ?? LOCATION_LABELS[b.locationType]],
        ["Attendee", `${b.fullName} <${b.email}>`],
        ["Company", b.company || "-"],
        ["Purpose", b.purpose],
      ],
      title: `${b.meetingType.name} with ${b.fullName}`,
    });
  }
  for (const bl of blocks) {
    for (const d of days) {
      const bounds = dayBounds.get(d)!;
      const s = Math.max(bl.startTimeUTC.getTime(), bounds.start);
      const e = Math.min(bl.endTimeUTC.getTime(), bounds.end);
      if (s >= e) continue;
      const allDay = s === bounds.start && e === bounds.end;
      events.push({
        id: bl.id,
        kind: "block",
        dayKey: d,
        startMin: minuteIn(d, s),
        endMin: minuteIn(d, e),
        label: allDay ? `${bl.kind === "VACATION" ? "Vacation" : "Unavailable"}` : `${formatTime(new Date(s), tz)} Blocked`,
        status: "block",
        allDay,
        title: bl.kind === "VACATION" ? "Vacation" : "Blocked time",
        rows: [
          ["From", formatInZone(bl.startTimeUTC, tz, { dateStyle: "medium", timeStyle: "short" })],
          ["Until", formatInZone(bl.endTimeUTC, tz, { dateStyle: "medium", timeStyle: "short" })],
          ["Reason", bl.reason || "-"],
        ],
      });
    }
  }

  const openWindows: Record<number, { start: number; end: number }[]> = {};
  for (const r of rules)
    (openWindows[r.weekday] ??= []).push({ start: minutesOf(r.startTime), end: r.endTime === "00:00" ? DAY_MINUTES : minutesOf(r.endTime) });
  const allTimes = [...Object.values(openWindows).flat(), ...events.filter((e) => e.kind === "booking" && days.length <= 7)];
  const firstHour = Math.max(0, Math.min(8, ...allTimes.map((w) => Math.floor(("startMin" in w ? w.startMin : w.start) / 60))));
  const lastHour = Math.min(24, Math.max(20, ...allTimes.map((w) => Math.ceil(("endMin" in w ? w.endMin : w.end) / 60))));

  const title =
    view === "month"
      ? formatInZone(zonedTimeToUtc(`${date.slice(0, 7)}-15`, "12:00", "UTC"), "UTC", { month: "long", year: "numeric" })
      : view === "week"
        ? `${formatInZone(zonedTimeToUtc(days[0], "12:00", "UTC"), "UTC", { month: "short", day: "numeric" })} - ${formatInZone(zonedTimeToUtc(days[6], "12:00", "UTC"), "UTC", { month: "short", day: "numeric", year: "numeric" })}`
        : formatInZone(zonedTimeToUtc(date, "12:00", "UTC"), "UTC", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const step = (dir: number) =>
    view === "day" ? addDays(date, dir) : view === "week" ? addDays(date, dir * 7) : addDays(`${date.slice(0, 7)}-15`, dir * 30).slice(0, 7) + "-01";


  return (
    <AdminCalendar
      view={view}
      date={date}
      today={today}
      title={title}
      timezone={tz}
      prevDate={step(-1)}
      nextDate={step(1)}
      days={days.map((d) => ({
        key: d,
        label: formatInZone(zonedTimeToUtc(d, "12:00", "UTC"), "UTC", { weekday: "short", day: "numeric" }),
        dayNumber: Number(d.slice(8)),
        outside: view === "month" && d.slice(0, 7) !== date.slice(0, 7),
        closed: !(openWindows[weekdayOf(d)]?.length),
        open: openWindows[weekdayOf(d)] ?? [],
        breaks: breaks
          .filter((b) => b.weekday === null || b.weekday === weekdayOf(d))
          .map((b) => ({ start: minutesOf(b.startTime), end: minutesOf(b.endTime) })),
      }))}
      events={events}
      firstHour={firstHour}
      lastHour={lastHour}
      nowMinute={days.includes(today) ? minuteIn(today, now.getTime()) : null}
    />
  );
}
