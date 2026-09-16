import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { computeSlots, isSlotBookable, type AvailabilityInput } from "../src/lib/booking/availability";
import { dateKeyInZone, formatTime, wallTimeInZone, zonedTimeToUtc } from "../src/lib/booking/time";

try {
  process.loadEnvFile();
} catch {
  /* CI uses injected configuration. */
}

/* ------------------------------------------------------------------ */
/* Pure timezone + availability rules (no server needed)               */
/* ------------------------------------------------------------------ */

test.describe("booking time rules", () => {
  test("wall times convert across daylight-saving changes", () => {
    // Toronto: EST (UTC-5) before 2026-03-08 02:00, EDT (UTC-4) after.
    expect(zonedTimeToUtc("2026-03-07", "11:00", "America/Toronto").toISOString()).toBe("2026-03-07T16:00:00.000Z");
    expect(zonedTimeToUtc("2026-03-09", "11:00", "America/Toronto").toISOString()).toBe("2026-03-09T15:00:00.000Z");
    // 02:30 does not exist on the spring-forward day; it resolves after the gap.
    expect(wallTimeInZone(zonedTimeToUtc("2026-03-08", "02:30", "America/Toronto"), "America/Toronto")).toBe("03:30");
    // 01:30 happens twice on the fall-back day; the first (EDT) occurrence wins.
    expect(zonedTimeToUtc("2026-11-01", "01:30", "America/Toronto").toISOString()).toBe("2026-11-01T05:30:00.000Z");
    // No DST: Dhaka is always UTC+6.
    expect(zonedTimeToUtc("2026-07-01", "11:00", "Asia/Dhaka").toISOString()).toBe("2026-07-01T05:00:00.000Z");
    expect(dateKeyInZone(new Date("2026-07-01T20:00:00Z"), "Asia/Tokyo")).toBe("2026-07-02");
  });

  const base = (overrides: Partial<AvailabilityInput> = {}): AvailabilityInput => ({
    timezone: "America/Toronto",
    minNoticeMinutes: 0,
    maxDaysAhead: 60,
    slotIntervalMinutes: 30,
    maxPerDay: 0,
    rules: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: "11:00", endTime: "16:00" })),
    breaks: [],
    blocked: [],
    busyBookings: [],
    externalBusy: [],
    meeting: { durationMinutes: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 },
    ...overrides,
  });
  const now = new Date("2026-03-01T00:00:00Z");
  const dayRange = (key: string): [Date, Date] => [
    zonedTimeToUtc(key, "00:00", "America/Toronto"),
    zonedTimeToUtc(key, "23:59", "America/Toronto"),
  ];

  test("weekly hours keep their wall-clock time on both sides of DST", () => {
    const before = computeSlots(base(), ...dayRange("2026-03-06"), now);
    const after = computeSlots(base(), ...dayRange("2026-03-09"), now);
    expect(before).toHaveLength(10);
    expect(after).toHaveLength(10);
    expect(formatTime(before[0], "America/Toronto")).toBe("11:00 AM");
    expect(formatTime(after[0], "America/Toronto")).toBe("11:00 AM");
    expect(after[0].getTime() - before[0].getTime()).toBe(3 * 86_400_000 - 3_600_000);
  });

  test("breaks, blocks, buffers, notice, horizon and daily limits remove slots", () => {
    const [start, end] = dayRange("2026-03-09");
    const at = (t: string) => zonedTimeToUtc("2026-03-09", t, "America/Toronto");
    const withBreak = computeSlots(base({ breaks: [{ weekday: null, startTime: "13:00", endTime: "14:00" }] }), start, end, now);
    expect(withBreak.map((s) => wallTimeInZone(s, "America/Toronto"))).not.toContain("13:30");
    expect(withBreak).toHaveLength(8);

    const blocked = base({ blocked: [{ start: at("11:00").getTime(), end: at("12:00").getTime() }] });
    expect(isSlotBookable(blocked, at("11:30"), now)).toBe(false);
    expect(isSlotBookable(blocked, at("12:00"), now)).toBe(true);

    // Existing 12:00-12:30 booking with a 15 min after-buffer blocks 12:00 and 12:30.
    const busy = base({
      busyBookings: [{ start: at("12:00").getTime(), end: at("12:45").getTime(), dayKey: "2026-03-09" }],
    });
    expect(isSlotBookable(busy, at("11:30"), now)).toBe(true);
    expect(isSlotBookable(busy, at("12:30"), now)).toBe(false);
    expect(isSlotBookable(busy, at("13:00"), now)).toBe(true);
    // The new meeting's own before-buffer also counts.
    const buffered = base({ ...busy, meeting: { durationMinutes: 30, bufferBeforeMinutes: 20, bufferAfterMinutes: 0 } });
    expect(isSlotBookable(buffered, at("13:00"), now)).toBe(false);

    expect(isSlotBookable(base(), at("11:15"), now)).toBe(false); // off-interval
    expect(computeSlots(base({ minNoticeMinutes: 60 * 24 * 30 }), start, end, now)).toHaveLength(0);
    expect(computeSlots(base({ maxDaysAhead: 3 }), start, end, now)).toHaveLength(0);
    expect(computeSlots(base({ maxPerDay: 1, busyBookings: busy.busyBookings }), start, end, now)).toHaveLength(0);
    expect(computeSlots(base({ externalBusy: [{ start: at("11:00").getTime(), end: at("16:00").getTime() }] }), start, end, now)).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/* Public page                                                         */
/* ------------------------------------------------------------------ */

test("/booking: renders, metadata and accessibility", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const response = await page.goto("/booking");
  expect(response?.status()).toBe(200);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/booking$/);
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity),
  );
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ */
/* Server-side booking guarantees (writes to the local database)       */
/* ------------------------------------------------------------------ */

test.describe("booking API against the local database", () => {
  const enabled = process.env.TEST_ENABLE_DB === "true";
  test.skip(!enabled, "Set TEST_ENABLE_DB=true with a local test database.");
  const prisma = new PrismaClient();
  const run = randomUUID().slice(0, 8);
  const email = (n: number | string) => `booking-test-${run}-${n}@example.invalid`;
  const ip = (n: number) => ({ "X-Forwarded-For": `10.${Number.parseInt(run.slice(0, 2), 16)}.${n}.1` });

  test.beforeAll(() => {
    if (!["localhost", "127.0.0.1", "::1"].includes(new URL(process.env.DATABASE_URL!).hostname))
      throw new Error("Booking tests require a local database.");
  });
  test.afterAll(async () => {
    await prisma.booking.deleteMany({ where: { email: { contains: `booking-test-${run}` } } });
    await prisma.$disconnect();
  });

  test("simultaneous bookings for one slot: exactly one succeeds; reschedule and cancel free it", async ({ request }) => {
    const type = await prisma.meetingType.findFirst({ where: { active: true }, orderBy: { durationMinutes: "asc" } });
    test.skip(!type, "No active meeting type");
    const start = new Date(Date.now() + 86_400_000);
    const end = new Date(Date.now() + 30 * 86_400_000);
    const slotsRes = await request.get(`/api/booking/slots?type=${type!.slug}&start=${start.toISOString()}&end=${end.toISOString()}`);
    const { slots } = (await slotsRes.json()) as { slots: string[] };
    test.skip(slots.length < 2, "Not enough availability to test");
    const target = slots[slots.length - 1];

    const attempt = (n: number) =>
      request.post("/api/booking", {
        headers: ip(n),
        data: {
          meetingType: type!.slug,
          start: target,
          fullName: `Booking Test ${n}`,
          email: email(n),
          purpose: "Automated concurrency test",
          visitorTimezone: "America/Toronto",
          startedAt: Date.now() - 10_000,
        },
      });
    const responses = await Promise.all([1, 2, 3, 4, 5].map(attempt));
    const statuses = responses.map((r) => r.status());
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(4);
    const conflict = responses.find((r) => r.status() === 409)!;
    expect((await conflict.json()).error).toBe("This time slot was just booked. Please choose another available time.");

    const winner = await responses.find((r) => r.status() === 201)!.json();
    expect(winner.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const after = (await (await request.get(`/api/booking/slots?type=${type!.slug}&start=${start.toISOString()}&end=${end.toISOString()}`)).json()).slots;
    expect(after).not.toContain(target);

    // Manage page never exposes the database id and is not indexable.
    const booking = await prisma.booking.findUniqueOrThrow({ where: { bookingToken: winner.token } });
    const manage = await request.get(`/booking/${winner.token}`);
    const html = await manage.text();
    expect(html).not.toContain(booking.id);
    expect(html).toContain("noindex");

    // Reschedule to another free slot: old record is marked RESCHEDULED, slot frees up.
    const other = after.find((s: string) => s !== target && Math.abs(Date.parse(s) - Date.parse(target)) > 3 * 3_600_000)!;
    const moved = await request.post(`/api/booking/${winner.token}/reschedule`, {
      headers: ip(9),
      data: { start: other, visitorTimezone: "Europe/London" },
    });
    expect(moved.status()).toBe(200);
    const { token: newToken } = await moved.json();
    expect((await prisma.booking.findUniqueOrThrow({ where: { bookingToken: winner.token } })).status).toBe("RESCHEDULED");
    const again = (await (await request.get(`/api/booking/slots?type=${type!.slug}&start=${start.toISOString()}&end=${end.toISOString()}`)).json()).slots;
    expect(again).toContain(target);
    expect(again).not.toContain(other);

    const ics = await request.get(`/api/booking/${newToken}/ics`);
    expect(ics.headers()["content-type"]).toContain("text/calendar");
    expect(await ics.text()).toContain("BEGIN:VEVENT");

    const cancel = await request.post(`/api/booking/${newToken}/cancel`, { headers: ip(9), data: { reason: "test" } });
    expect(cancel.status()).toBe(200);
    const final = (await (await request.get(`/api/booking/slots?type=${type!.slug}&start=${start.toISOString()}&end=${end.toISOString()}`)).json()).slots;
    expect(final).toContain(other);
  });

  test("rejects unavailable times, invalid input and bot submissions", async ({ request }) => {
    const type = await prisma.meetingType.findFirst({ where: { active: true } });
    test.skip(!type, "No active meeting type");
    const payload = {
      meetingType: type!.slug,
      fullName: "Booking Test",
      email: email("invalid"),
      purpose: "Validation test",
      visitorTimezone: "America/Toronto",
      startedAt: Date.now() - 10_000,
    };
    // 03:17 UTC tomorrow is never on the slot grid.
    const offGrid = new Date(Date.now() + 86_400_000);
    offGrid.setUTCHours(3, 17, 0, 0);
    expect((await request.post("/api/booking", { headers: ip(20), data: { ...payload, start: offGrid.toISOString() } })).status()).toBe(409);
    expect((await request.post("/api/booking", { headers: ip(21), data: { ...payload, start: offGrid.toISOString(), visitorTimezone: "Mars/Olympus" } })).status()).toBe(400);
    expect((await request.post("/api/booking", { headers: ip(22), data: { ...payload, start: offGrid.toISOString(), website: "spam" } })).status()).toBe(400);
    expect((await request.get("/booking/not-a-real-token")).status()).toBe(404);
  });
});
