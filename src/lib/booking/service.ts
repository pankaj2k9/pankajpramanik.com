import { Prisma, type Booking, type BookingSource, type BookingStatus, type MeetingType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  computeSlots,
  effectiveBuffers,
  isSlotBookable,
  occupiedInterval,
  type AvailabilityInput,
  type Interval,
} from "./availability";
import { newBookingToken, newReference } from "./crypto";
import {
  clearBusyCache,
  createGoogleEvent,
  deleteGoogleEvent,
  googleBusy,
  updateGoogleEvent,
  type CalendarSyncResult,
} from "./google";
import { ACTIVE_STATUSES, SLOT_TAKEN_MESSAGE } from "./labels";
import { notify, scheduleReminders } from "./notifications";
import { dateKeyInZone } from "./time";

type Tx = Prisma.TransactionClient;
const DAY = 86_400_000;

/**
 * Every write that can take a slot runs inside one transaction holding this
 * Postgres advisory lock, and re-computes availability from the database
 * inside it. Two simultaneous requests for the same time are serialised: the
 * second sees the first booking and fails with SlotTakenError. The lock is
 * released automatically on commit or rollback.
 */
const BOOKING_LOCK = 0x626f6f6b; // "book"

export class SlotTakenError extends Error {
  constructor() {
    super(SLOT_TAKEN_MESSAGE);
  }
}

export class BookingError extends Error {}

export async function getBookingSettings(db: Tx | typeof prisma = prisma) {
  return db.bookingSettings.upsert({ where: { id: "default" }, create: { id: "default" }, update: {} });
}

/**
 * Loads everything the slot engine needs for [start, end). Bookings are read
 * two days either side so per-day limits and buffers across the range edges
 * are counted correctly.
 */
export async function loadAvailability(
  db: Tx | typeof prisma,
  meetingType: MeetingType,
  start: Date,
  end: Date,
  { excludeBookingId, externalBusy = [] }: { excludeBookingId?: string; externalBusy?: Interval[] } = {},
): Promise<AvailabilityInput> {
  const settings = await getBookingSettings(db);
  const from = new Date(start.getTime() - 2 * DAY);
  const to = new Date(end.getTime() + 2 * DAY);
  const [rules, breaks, blocked, bookings] = await Promise.all([
    db.availabilityRule.findMany({ where: { active: true } }),
    db.availabilityBreak.findMany(),
    db.blockedTime.findMany({ where: { startTimeUTC: { lt: to }, endTimeUTC: { gt: from } } }),
    db.booking.findMany({
      where: {
        status: { in: ACTIVE_STATUSES },
        startTimeUTC: { lt: to },
        endTimeUTC: { gt: from },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
      select: { startTimeUTC: true, endTimeUTC: true, bufferBeforeMinutes: true, bufferAfterMinutes: true },
    }),
  ]);
  return {
    timezone: settings.timezone,
    minNoticeMinutes: settings.minNoticeMinutes,
    maxDaysAhead: settings.maxDaysAhead,
    slotIntervalMinutes: settings.slotIntervalMinutes,
    maxPerDay: settings.maxPerDay,
    rules,
    breaks,
    blocked: blocked.map((b) => ({ start: b.startTimeUTC.getTime(), end: b.endTimeUTC.getTime() })),
    busyBookings: bookings.map((b) => ({
      ...occupiedInterval(b.startTimeUTC.getTime(), b.endTimeUTC.getTime(), b.bufferBeforeMinutes, b.bufferAfterMinutes),
      dayKey: dateKeyInZone(b.startTimeUTC, settings.timezone),
    })),
    externalBusy,
    meeting: { durationMinutes: meetingType.durationMinutes, ...effectiveBuffers(settings, meetingType) },
  };
}

export async function getPublicSlots(meetingType: MeetingType, start: Date, end: Date, excludeBookingId?: string) {
  const externalBusy = await googleBusy(start, end);
  const input = await loadAvailability(prisma, meetingType, start, end, { excludeBookingId, externalBusy });
  return computeSlots(input, start, end);
}

export type BookingDetails = {
  fullName: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  purpose: string;
  notes?: string | null;
  visitorTimezone: string;
};

async function lockedTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BOOKING_LOCK}::int)`;
      return fn(tx);
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
}

/**
 * Checks the slot with a fresh Google free/busy read (outside the lock, since
 * it is a network call) and the database state inside the lock.
 */
async function assertSlot(
  tx: Tx,
  meetingType: MeetingType,
  start: Date,
  externalBusy: Interval[],
  excludeBookingId?: string,
) {
  const input = await loadAvailability(tx, meetingType, start, new Date(start.getTime() + 60_000), {
    excludeBookingId,
    externalBusy,
  });
  if (!isSlotBookable(input, start)) throw new SlotTakenError();
  return input;
}

/** Conflicts with other bookings or blocks only (admin overrides skip hours/notice). */
async function assertNoConflict(tx: Tx, meetingType: MeetingType, start: Date, end: Date, excludeBookingId?: string) {
  const input = await loadAvailability(tx, meetingType, start, end, { excludeBookingId });
  const occupied = occupiedInterval(
    start.getTime(),
    end.getTime(),
    input.meeting.bufferBeforeMinutes,
    input.meeting.bufferAfterMinutes,
  );
  const clash = (i: Interval) => occupied.start < i.end && i.start < occupied.end;
  if (input.busyBookings.some(clash)) throw new SlotTakenError();
  if (input.blocked.some(clash)) throw new BookingError("That time overlaps a blocked period.");
  return input;
}

/**
 * Writes the booking to Google Calendar: moves its existing event, or creates
 * one when there is none (or it was deleted in Google). `attendeeNotified`
 * tells the caller Google emailed the visitor, so the Resend visitor email
 * must be skipped; on any failure it is false and Resend sends it instead.
 */
async function syncCalendar(
  booking: Booking & { meetingType: MeetingType },
  { notify }: { notify: boolean },
): Promise<{ booking: Booking & { meetingType: MeetingType }; attendeeNotified: boolean }> {
  let result: CalendarSyncResult | null = null;
  try {
    if (booking.calendarEventId) result = await updateGoogleEvent(booking, { notify });
    if (!result) result = await createGoogleEvent(booking, { notify });
  } catch (error) {
    console.error("Calendar sync failed:", error instanceof Error ? error.message : error);
  } finally {
    clearBusyCache();
  }
  if (!result) return { booking, attendeeNotified: false };
  // Google has already sent its email at this point, so a failed save below
  // must not turn into a second email through Resend.
  try {
    const saved = await prisma.booking.update({
      where: { id: booking.id },
      data: { calendarEventId: result.eventId, meetingUrl: result.meetingUrl ?? booking.meetingUrl },
      include: { meetingType: true },
    });
    return { booking: saved, attendeeNotified: result.attendeeNotified };
  } catch (error) {
    console.error("Saving calendar event id failed:", error instanceof Error ? error.message : error);
    return { booking, attendeeNotified: result.attendeeNotified };
  }
}

export async function createBooking(
  meetingType: MeetingType,
  start: Date,
  details: BookingDetails,
  {
    source = "PUBLIC",
    status,
    override = false,
    sendEmails = true,
    meetingUrl,
    adminNotes,
  }: {
    source?: BookingSource;
    status?: BookingStatus;
    /** Admin only: ignore working hours, notice and day limits (still no overlaps). */
    override?: boolean;
    sendEmails?: boolean;
    meetingUrl?: string | null;
    adminNotes?: string | null;
  } = {},
) {
  const end = new Date(start.getTime() + meetingType.durationMinutes * 60_000);
  const externalBusy = override ? [] : await googleBusy(start, end, { fresh: true });

  const booking = await lockedTransaction(async (tx) => {
    const settings = await getBookingSettings(tx);
    const input = override
      ? await assertNoConflict(tx, meetingType, start, end)
      : await assertSlot(tx, meetingType, start, externalBusy);
    return tx.booking.create({
      data: {
        bookingToken: newBookingToken(),
        reference: newReference(),
        meetingTypeId: meetingType.id,
        ...details,
        startTimeUTC: start,
        endTimeUTC: end,
        bufferBeforeMinutes: input.meeting.bufferBeforeMinutes,
        bufferAfterMinutes: input.meeting.bufferAfterMinutes,
        locationType: meetingType.locationType,
        status: status ?? (source === "PUBLIC" && settings.requireApproval ? "PENDING" : "CONFIRMED"),
        source,
        meetingUrl: meetingUrl || (meetingType.locationType !== "GOOGLE_MEET" && meetingType.locationType !== "PHONE" ? meetingType.locationDetail || null : null),
        adminNotes: adminNotes || null,
      },
      include: { meetingType: true },
    });
  });

  // Google Calendar's invitation is the visitor's confirmation when the event
  // was created with them as attendee; otherwise Resend sends it.
  const { booking: synced, attendeeNotified } = await syncCalendar(booking, { notify: sendEmails });
  await scheduleReminders(synced);
  if (sendEmails) {
    await notify(synced.id, ["VISITOR_CONFIRMATION"], { sentByGoogle: attendeeNotified });
    if (source === "PUBLIC") await notify(synced.id, ["ADMIN_NEW_BOOKING"]);
  }
  return synced;
}

/**
 * Moves a booking: the original is marked RESCHEDULED (freeing its slot) and a
 * new booking with a new token takes the new time, linked to the original.
 * The calendar event moves with it.
 */
export async function rescheduleBooking(
  bookingId: string,
  start: Date,
  { override = false, sendEmails = true, visitorTimezone }: { override?: boolean; sendEmails?: boolean; visitorTimezone?: string } = {},
) {
  const current = await prisma.booking.findUnique({ where: { id: bookingId }, include: { meetingType: true } });
  if (!current) throw new BookingError("Booking not found.");
  if (!["CONFIRMED", "PENDING"].includes(current.status))
    throw new BookingError("Only upcoming confirmed or pending bookings can be rescheduled.");
  const meetingType = current.meetingType;
  const end = new Date(start.getTime() + meetingType.durationMinutes * 60_000);
  const externalBusy = override ? [] : await googleBusy(start, end, { fresh: true });

  const moved = await lockedTransaction(async (tx) => {
    const fresh = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!fresh || !["CONFIRMED", "PENDING"].includes(fresh.status))
      throw new BookingError("This booking changed in the meantime. Refresh and try again.");
    const input = override
      ? await assertNoConflict(tx, meetingType, start, end, bookingId)
      : await assertSlot(tx, meetingType, start, externalBusy, bookingId);
    await tx.booking.update({
      where: { id: bookingId },
      data: { status: "RESCHEDULED", calendarEventId: null },
    });
    return tx.booking.create({
      data: {
        bookingToken: newBookingToken(),
        reference: newReference(),
        meetingTypeId: meetingType.id,
        fullName: fresh.fullName,
        email: fresh.email,
        phone: fresh.phone,
        company: fresh.company,
        purpose: fresh.purpose,
        notes: fresh.notes,
        adminNotes: fresh.adminNotes,
        visitorTimezone: visitorTimezone ?? fresh.visitorTimezone,
        startTimeUTC: start,
        endTimeUTC: end,
        bufferBeforeMinutes: input.meeting.bufferBeforeMinutes,
        bufferAfterMinutes: input.meeting.bufferAfterMinutes,
        locationType: fresh.locationType,
        status: fresh.status,
        source: fresh.source,
        meetingUrl: fresh.meetingUrl,
        calendarEventId: fresh.calendarEventId,
        rescheduledFromId: fresh.id,
      },
      include: { meetingType: true },
    });
  });

  await prisma.bookingNotification.deleteMany({ where: { bookingId, kind: "REMINDER", sentAt: null } });
  const { booking: synced, attendeeNotified } = await syncCalendar(moved, { notify: sendEmails });
  await scheduleReminders(synced);
  if (sendEmails) await notify(synced.id, ["VISITOR_RESCHEDULED"], { sentByGoogle: attendeeNotified });
  return synced;
}

export async function cancelBooking(
  bookingId: string,
  { reason, by, sendEmails = true }: { reason?: string; by: "visitor" | "admin"; sendEmails?: boolean },
) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new BookingError("Booking not found.");
  if (!["CONFIRMED", "PENDING"].includes(booking.status))
    throw new BookingError("This booking is not active and cannot be cancelled.");
  const cancelled = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "CANCELLED", cancelReason: reason || null, cancelledAt: new Date() },
  });
  await prisma.bookingNotification.deleteMany({ where: { bookingId, kind: "REMINDER", sentAt: null } });
  let attendeeNotified = false;
  try {
    ({ attendeeNotified } = await deleteGoogleEvent(cancelled.calendarEventId, {
      notify: sendEmails,
      attendeeEmail: cancelled.email,
    }));
  } catch (error) {
    console.error("Calendar event delete failed:", error instanceof Error ? error.message : error);
  }
  clearBusyCache();
  if (sendEmails) {
    await notify(bookingId, ["VISITOR_CANCELLED"], { sentByGoogle: attendeeNotified });
    if (by === "visitor") await notify(bookingId, ["ADMIN_CANCELLED"]);
  }
  return cancelled;
}

/** Status changes that do not touch the time slot (completed, no-show, confirm). */
export async function setBookingStatus(bookingId: string, status: BookingStatus) {
  const booking = await prisma.booking.update({ where: { id: bookingId }, data: { status }, include: { meetingType: true } });
  if (status === "COMPLETED" || status === "NO_SHOW")
    await prisma.bookingNotification.deleteMany({ where: { bookingId, kind: "REMINDER", sentAt: null } });
  return booking;
}

/**
 * Approves a pending request. The calendar event gains the visitor as
 * attendee, so Google sends the invitation; Resend confirms only when that
 * did not happen.
 */
export async function confirmPendingBooking(bookingId: string) {
  const current = await prisma.booking.findUnique({ where: { id: bookingId }, select: { status: true } });
  if (current?.status !== "PENDING") throw new BookingError("Only pending bookings can be approved.");
  const booking = await setBookingStatus(bookingId, "CONFIRMED");
  const { booking: synced, attendeeNotified } = await syncCalendar(booking, { notify: true });
  await scheduleReminders(synced);
  await notify(synced.id, ["VISITOR_CONFIRMATION"], { sentByGoogle: attendeeNotified });
  return synced;
}

export async function deleteBooking(bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return;
  if (booking.calendarEventId && ["CONFIRMED", "PENDING"].includes(booking.status)) {
    try {
      await deleteGoogleEvent(booking.calendarEventId);
    } catch (error) {
      console.error("Calendar event delete failed:", error instanceof Error ? error.message : error);
    }
  }
  await prisma.booking.delete({ where: { id: bookingId } });
  clearBusyCache();
}

export const isPrismaUniqueError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
