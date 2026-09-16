"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { formError } from "@/lib/form-error";
import { slugify } from "@/lib/utils";
import { bookingDetailsSchema } from "@/lib/booking/validation";
import {
  BookingError,
  cancelBooking,
  confirmPendingBooking,
  createBooking,
  deleteBooking,
  getBookingSettings,
  rescheduleBooking,
  setBookingStatus,
  SlotTakenError,
} from "@/lib/booking/service";
import { disconnectGoogle, clearBusyCache } from "@/lib/booking/google";
import {
  addDays,
  DATE_KEY_RE,
  isValidTimeZone,
  startOfDayUtc,
  WALL_TIME_RE,
  zonedTimeToUtc,
} from "@/lib/booking/time";

export type BookingFormState = { error?: string; ok?: string } | undefined;

const ADMIN_ROOT = "/admin/booking";

function revalidateBooking() {
  revalidatePath(ADMIN_ROOT, "layout");
  revalidatePath("/booking");
}

function failure(error: unknown): BookingFormState {
  if (error instanceof SlotTakenError || error instanceof BookingError) return { error: error.message };
  return formError(error);
}

const checkbox = (formData: FormData, name: string) => formData.get(name) === "on";

/* ------------------------------------------------------------------ */
/* Meeting types                                                       */
/* ------------------------------------------------------------------ */

const meetingTypeSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(120),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(600).default(""),
  durationMinutes: z.coerce.number().int().min(5, "Duration must be at least 5 minutes").max(480),
  bufferBeforeMinutes: z.coerce.number().int().min(0).max(240),
  bufferAfterMinutes: z.coerce.number().int().min(0).max(240),
  locationType: z.enum(["GOOGLE_MEET", "ZOOM", "MICROSOFT_TEAMS", "PHONE", "CUSTOM_LINK"]),
  locationDetail: z.string().trim().max(500).default(""),
  order: z.coerce.number().int().default(0),
});

function parseMeetingType(formData: FormData) {
  const parsed = meetingTypeSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug") || undefined,
    description: formData.get("description") ?? "",
    durationMinutes: formData.get("durationMinutes"),
    bufferBeforeMinutes: formData.get("bufferBeforeMinutes") || 0,
    bufferAfterMinutes: formData.get("bufferAfterMinutes") || 0,
    locationType: formData.get("locationType"),
    locationDetail: formData.get("locationDetail") ?? "",
    order: formData.get("order") || 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message } as const;
  const d = parsed.data;
  if (["ZOOM", "MICROSOFT_TEAMS", "CUSTOM_LINK"].includes(d.locationType) && d.locationDetail && !/^https:\/\//.test(d.locationDetail))
    return { error: "Meeting links must start with https://" } as const;
  return {
    data: { ...d, slug: slugify(d.slug || d.name), active: checkbox(formData, "active") },
  } as const;
}

export async function saveMeetingType(id: string | null, _prev: BookingFormState, formData: FormData): Promise<BookingFormState> {
  await requireAdmin();
  const parsed = parseMeetingType(formData);
  if ("error" in parsed) return { error: parsed.error };
  try {
    if (id) await prisma.meetingType.update({ where: { id }, data: parsed.data });
    else await prisma.meetingType.create({ data: parsed.data });
    revalidateBooking();
  } catch (error) {
    return failure(error);
  }
  redirect(`${ADMIN_ROOT}/meeting-types`);
}

export async function toggleMeetingType(id: string, active: boolean) {
  await requireAdmin();
  await prisma.meetingType.update({ where: { id }, data: { active } });
  revalidateBooking();
}

/** Deletes a meeting type, or deactivates it when bookings still reference it. */
export async function deleteMeetingType(id: string) {
  await requireAdmin();
  const used = await prisma.booking.count({ where: { meetingTypeId: id } });
  if (used) await prisma.meetingType.update({ where: { id }, data: { active: false } });
  else await prisma.meetingType.delete({ where: { id } });
  revalidateBooking();
}

/* ------------------------------------------------------------------ */
/* Availability + settings                                             */
/* ------------------------------------------------------------------ */

const windowSchema = z
  .object({ startTime: z.string().regex(WALL_TIME_RE), endTime: z.string().regex(WALL_TIME_RE) })
  .refine((w) => w.endTime > w.startTime || w.endTime === "00:00", "End time must be after start time");

const availabilitySchema = z.object({
  rules: z.array(windowSchema.and(z.object({ weekday: z.number().int().min(0).max(6) }))).max(70),
  breaks: z.array(windowSchema.and(z.object({ weekday: z.number().int().min(0).max(6).nullable(), label: z.string().max(80).default("") }))).max(50),
});

export async function saveAvailability(_prev: BookingFormState, formData: FormData): Promise<BookingFormState> {
  await requireAdmin();
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { error: "Could not read the schedule. Refresh and try again." };
  }
  const parsed = availabilitySchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const settings = settingsSchema.pick({
    minNoticeMinutes: true,
    maxDaysAhead: true,
    slotIntervalMinutes: true,
    maxPerDay: true,
    bufferBeforeMinutes: true,
    bufferAfterMinutes: true,
  }).safeParse({
    minNoticeMinutes: formData.get("minNoticeMinutes"),
    maxDaysAhead: formData.get("maxDaysAhead"),
    slotIntervalMinutes: formData.get("slotIntervalMinutes"),
    maxPerDay: formData.get("maxPerDay"),
    bufferBeforeMinutes: formData.get("bufferBeforeMinutes"),
    bufferAfterMinutes: formData.get("bufferAfterMinutes"),
  });
  if (!settings.success) return { error: settings.error.issues[0].message };

  try {
    await prisma.$transaction([
      prisma.availabilityRule.deleteMany(),
      prisma.availabilityRule.createMany({ data: parsed.data.rules }),
      prisma.availabilityBreak.deleteMany(),
      prisma.availabilityBreak.createMany({ data: parsed.data.breaks }),
      prisma.bookingSettings.upsert({
        where: { id: "default" },
        create: { id: "default", ...settings.data },
        update: settings.data,
      }),
    ]);
    revalidateBooking();
    return { ok: "Availability saved." };
  } catch (error) {
    return failure(error);
  }
}

const settingsSchema = z.object({
  timezone: z.string().refine(isValidTimeZone, "Choose a valid timezone"),
  minNoticeMinutes: z.coerce.number().int().min(0).max(60 * 24 * 30),
  maxDaysAhead: z.coerce.number().int().min(1, "Allow booking at least 1 day ahead").max(365),
  slotIntervalMinutes: z.coerce.number().int().min(5).max(240),
  maxPerDay: z.coerce.number().int().min(0).max(50),
  bufferBeforeMinutes: z.coerce.number().int().min(0).max(240),
  bufferAfterMinutes: z.coerce.number().int().min(0).max(240),
  notifyEmail: z.string().trim().email("Enter a valid notification email").or(z.literal("")),
  reminderOffsets: z.array(z.number().int().min(5).max(60 * 24 * 7)).max(6),
});

export async function saveBookingSettings(_prev: BookingFormState, formData: FormData): Promise<BookingFormState> {
  await requireAdmin();
  const current = await getBookingSettings();
  const parsed = settingsSchema
    .pick({ timezone: true, notifyEmail: true, reminderOffsets: true })
    .safeParse({
      timezone: formData.get("timezone"),
      notifyEmail: formData.get("notifyEmail") ?? "",
      reminderOffsets: formData.getAll("reminderOffsets").map(Number),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await prisma.bookingSettings.update({
      where: { id: current.id },
      data: {
        ...parsed.data,
        bookingEnabled: checkbox(formData, "bookingEnabled"),
        requireApproval: checkbox(formData, "requireApproval"),
      },
    });
    const conn = await prisma.calendarConnection.findUnique({ where: { provider: "google" } });
    if (conn)
      await prisma.calendarConnection.update({
        where: { id: conn.id },
        data: {
          checkBusy: checkbox(formData, "checkBusy"),
          createEvents: checkbox(formData, "createEvents"),
          createMeetLinks: checkbox(formData, "createMeetLinks"),
          calendarId: String(formData.get("calendarId") || "primary").slice(0, 200),
        },
      });
    clearBusyCache();
    revalidateBooking();
    return { ok: "Settings saved." };
  } catch (error) {
    return failure(error);
  }
}

export async function disconnectGoogleCalendar() {
  await requireAdmin();
  await disconnectGoogle();
  clearBusyCache();
  revalidateBooking();
}

/* ------------------------------------------------------------------ */
/* Blocked time                                                        */
/* ------------------------------------------------------------------ */

const blockSchema = z.object({
  startDate: z.string().regex(DATE_KEY_RE, "Choose a start date"),
  endDate: z.string().regex(DATE_KEY_RE, "Choose an end date"),
  startTime: z.string().regex(WALL_TIME_RE).optional().or(z.literal("")),
  endTime: z.string().regex(WALL_TIME_RE).optional().or(z.literal("")),
  kind: z.enum(["BLOCKED", "VACATION"]),
  reason: z.string().trim().max(200).default(""),
});

export async function createBlockedTime(_prev: BookingFormState, formData: FormData): Promise<BookingFormState> {
  await requireAdmin();
  const parsed = blockSchema.safeParse({
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || formData.get("startDate"),
    startTime: formData.get("startTime") ?? "",
    endTime: formData.get("endTime") ?? "",
    kind: formData.get("kind") || "BLOCKED",
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { timezone } = await getBookingSettings();
  const d = parsed.data;
  const allDay = checkbox(formData, "allDay") || !d.startTime || !d.endTime;
  const start = allDay ? startOfDayUtc(d.startDate, timezone) : zonedTimeToUtc(d.startDate, d.startTime!, timezone);
  const end = allDay ? startOfDayUtc(addDays(d.endDate, 1), timezone) : zonedTimeToUtc(d.endDate, d.endTime!, timezone);
  if (end <= start) return { error: "The end must be after the start." };
  try {
    await prisma.blockedTime.create({ data: { startTimeUTC: start, endTimeUTC: end, kind: d.kind, reason: d.reason } });
    revalidateBooking();
    return { ok: "Time blocked." };
  } catch (error) {
    return failure(error);
  }
}

export async function markDayUnavailable(dateKey: string) {
  await requireAdmin();
  if (!DATE_KEY_RE.test(dateKey)) throw new Error("Invalid date");
  const { timezone } = await getBookingSettings();
  await prisma.blockedTime.create({
    data: {
      startTimeUTC: startOfDayUtc(dateKey, timezone),
      endTimeUTC: startOfDayUtc(addDays(dateKey, 1), timezone),
      kind: "BLOCKED",
      reason: "Day marked unavailable",
    },
  });
  revalidateBooking();
}

export async function deleteBlockedTime(id: string) {
  await requireAdmin();
  await prisma.blockedTime.delete({ where: { id } });
  revalidateBooking();
}

/* ------------------------------------------------------------------ */
/* Bookings                                                            */
/* ------------------------------------------------------------------ */

function adminStart(formData: FormData, timezone: string) {
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  if (!DATE_KEY_RE.test(date) || !WALL_TIME_RE.test(time)) return null;
  return zonedTimeToUtc(date, time, timezone);
}

export async function createManualBooking(_prev: BookingFormState, formData: FormData): Promise<BookingFormState> {
  await requireAdmin();
  const settings = await getBookingSettings();
  const meetingType = await prisma.meetingType.findUnique({ where: { id: String(formData.get("meetingTypeId") ?? "") } });
  if (!meetingType) return { error: "Choose a meeting type." };
  const start = adminStart(formData, settings.timezone);
  if (!start) return { error: "Choose a valid date and time." };
  const details = bookingDetailsSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    company: formData.get("company") || undefined,
    phone: formData.get("phone") || undefined,
    purpose: formData.get("purpose"),
    notes: formData.get("notes") || undefined,
    visitorTimezone: formData.get("visitorTimezone") || settings.timezone,
  });
  if (!details.success) return { error: details.error.issues[0].message };
  let id: string;
  try {
    const booking = await createBooking(meetingType, start, details.data, {
      source: "ADMIN",
      status: (formData.get("status") as BookingStatus) === "PENDING" ? "PENDING" : "CONFIRMED",
      override: checkbox(formData, "override"),
      sendEmails: checkbox(formData, "notify"),
      meetingUrl: String(formData.get("meetingUrl") ?? "").trim() || null,
      adminNotes: String(formData.get("adminNotes") ?? "").trim() || null,
    });
    id = booking.id;
    revalidateBooking();
  } catch (error) {
    return failure(error);
  }
  redirect(`${ADMIN_ROOT}/bookings/${id}`);
}

const editSchema = bookingDetailsSchema.omit({ visitorTimezone: true }).extend({
  meetingUrl: z.string().trim().url("Meeting link must be a valid URL").max(500).or(z.literal("")),
  adminNotes: z.string().trim().max(3000).default(""),
});

export async function updateBookingDetails(id: string, _prev: BookingFormState, formData: FormData): Promise<BookingFormState> {
  await requireAdmin();
  const parsed = editSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    company: formData.get("company") || undefined,
    phone: formData.get("phone") || undefined,
    purpose: formData.get("purpose"),
    notes: formData.get("notes") || undefined,
    meetingUrl: formData.get("meetingUrl") ?? "",
    adminNotes: formData.get("adminNotes") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await prisma.booking.update({
      where: { id },
      data: { ...parsed.data, meetingUrl: parsed.data.meetingUrl || null, adminNotes: parsed.data.adminNotes || null },
    });
    revalidateBooking();
    return { ok: "Booking updated." };
  } catch (error) {
    return failure(error);
  }
}

export async function adminRescheduleBooking(id: string, _prev: BookingFormState, formData: FormData): Promise<BookingFormState> {
  await requireAdmin();
  const settings = await getBookingSettings();
  const start = adminStart(formData, settings.timezone);
  if (!start) return { error: "Choose a valid date and time." };
  let newId: string;
  try {
    const moved = await rescheduleBooking(id, start, {
      override: checkbox(formData, "override"),
      sendEmails: checkbox(formData, "notify"),
    });
    newId = moved.id;
    revalidateBooking();
  } catch (error) {
    return failure(error);
  }
  redirect(`${ADMIN_ROOT}/bookings/${newId}`);
}

export async function adminCancelBooking(id: string, _prev: BookingFormState, formData: FormData): Promise<BookingFormState> {
  await requireAdmin();
  try {
    await cancelBooking(id, {
      by: "admin",
      reason: String(formData.get("reason") ?? "").trim().slice(0, 500) || undefined,
      sendEmails: checkbox(formData, "notify"),
    });
    revalidateBooking();
    return { ok: "Booking cancelled." };
  } catch (error) {
    return failure(error);
  }
}

const QUICK_STATUSES: BookingStatus[] = ["CONFIRMED", "COMPLETED", "NO_SHOW", "PENDING"];

export async function changeBookingStatus(id: string, status: BookingStatus) {
  await requireAdmin();
  if (!QUICK_STATUSES.includes(status)) throw new Error("Use cancel or reschedule for this status.");
  const before = await prisma.booking.findUnique({ where: { id }, select: { status: true } });
  // Approving a pending request sends the confirmation (Google invitation or
  // Resend email) and schedules reminders.
  if (before?.status === "PENDING" && status === "CONFIRMED") await confirmPendingBooking(id);
  else await setBookingStatus(id, status);
  revalidateBooking();
}

export async function quickCancelBooking(id: string) {
  await requireAdmin();
  await cancelBooking(id, { by: "admin", sendEmails: true });
  revalidateBooking();
}

export async function removeBooking(id: string) {
  await requireAdmin();
  await deleteBooking(id);
  revalidateBooking();
}

export async function removeBookingAndReturn(id: string) {
  await removeBooking(id);
  redirect(`${ADMIN_ROOT}/bookings`);
}
