import type { Booking, BookingNotification, MeetingType, NotificationKind } from "@prisma/client";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { site } from "@/lib/site";
import { bookingIcs, googleCalendarUrl, manageUrl } from "./ics";
import { durationLabel, locationDescription } from "./labels";
import { formatInZone, formatLongDate, formatTime } from "./time";

/**
 * Booking email via the site's existing Resend setup (same env as the contact
 * form). Every email is recorded in BookingNotification first, so delivery can
 * be retried and reminders are sent by /api/cron/booking-reminders.
 */

type BookingWithType = Booking & { meetingType: MeetingType };

const fromAddress = () =>
  process.env.BOOKING_FROM_EMAIL ?? process.env.CONTACT_FROM_EMAIL ?? "Pankaj Kumar Pramanik <onboarding@resend.dev>";

async function adminAddress() {
  const settings = await prisma.bookingSettings.findUnique({ where: { id: "default" } });
  return settings?.notifyEmail || process.env.CONTACT_EMAIL || "";
}

function when(booking: Booking, timeZone: string) {
  const minutes = Math.round((booking.endTimeUTC.getTime() - booking.startTimeUTC.getTime()) / 60000);
  return {
    date: formatLongDate(booking.startTimeUTC, timeZone),
    time: `${formatTime(booking.startTimeUTC, timeZone)} - ${formatTime(booking.endTimeUTC, timeZone)}`,
    zone: `${timeZone} (${formatInZone(booking.startTimeUTC, timeZone, { timeZoneName: "short" }).split(" ").pop()})`,
    duration: durationLabel(minutes),
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

function render(
  title: string,
  intro: string,
  rows: [string, string][],
  actions: [string, string][] = [],
  closing = "",
  signed = true,
) {
  const signature = signed ? ["Best regards,", site.name, "AI & Data Engineer · pankajpramanik.com"] : [];
  const text = [
    title,
    "",
    intro,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ...(actions.length ? ["", ...actions.map(([label, url]) => `${label}: ${url}`)] : []),
    ...(closing ? ["", closing] : []),
    ...(signature.length ? ["", ...signature] : []),
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f3f6fa;font-family:Inter,Segoe UI,Arial,sans-serif;color:#1b2c47">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #dae2ed;border-radius:18px" cellpadding="0" cellspacing="0">
<tr><td style="padding:32px">
<p style="margin:0 0 6px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#5b6a81">${escapeHtml(site.name)}</p>
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">${escapeHtml(title)}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#50627a">${escapeHtml(intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #dae2ed">
${rows
  .map(
    ([k, v]) =>
      `<tr><td style="padding:10px 0;border-bottom:1px solid #eaf0f8;font-size:13px;color:#5b6a81;width:34%;vertical-align:top">${escapeHtml(k)}</td><td style="padding:10px 0;border-bottom:1px solid #eaf0f8;font-size:14px;vertical-align:top">${escapeHtml(v)}</td></tr>`,
  )
  .join("")}
</table>
${
  actions.length
    ? `<p style="margin:24px 0 0">${actions
        .map(
          ([label, url], i) =>
            `<a href="${escapeHtml(url)}" style="display:inline-block;margin:0 8px 8px 0;padding:11px 18px;border-radius:999px;font-size:14px;font-weight:600;text-decoration:none;${i === 0 ? "background:#1b2c47;color:#ffffff" : "border:1px solid #dae2ed;color:#1b2c47"}">${escapeHtml(label)}</a>`,
        )
        .join("")}</p>`
    : ""
}
${closing ? `<p style="margin:22px 0 0;font-size:14px;line-height:1.6;color:#50627a">${escapeHtml(closing)}</p>` : ""}
${
  signature.length
    ? `<p style="margin:22px 0 0;font-size:14px;line-height:1.6;color:#1b2c47">${escapeHtml(signature[0])}<br><strong>${escapeHtml(signature[1])}</strong><br><span style="color:#5b6a81">${escapeHtml(signature[2])}</span></p>`
    : ""
}
</td></tr></table></td></tr></table></body></html>`;
  return { text, html };
}

function visitorRows(booking: BookingWithType): [string, string][] {
  const w = when(booking, booking.visitorTimezone);
  return [
    ["Meeting", booking.meetingType.name],
    ["Date", w.date],
    ["Time", w.time],
    ["Timezone", w.zone],
    ["Duration", w.duration],
    ["How to join", locationDescription(booking.locationType, booking.meetingType.locationDetail, booking.meetingUrl)],
    ["Reference", booking.reference],
  ];
}

type Composed = { to: string; subject: string; text: string; html: string; replyTo?: string; ics?: "PUBLISH" | "CANCEL" };

async function compose(kind: NotificationKind, booking: BookingWithType, offsetMinutes: number | null): Promise<Composed | null> {
  const manage = manageUrl(booking.bookingToken);
  switch (kind) {
    case "VISITOR_CONFIRMATION": {
      const pending = booking.status === "PENDING";
      const { text, html } = render(
        pending ? "Your booking request has been received" : "Your meeting is confirmed",
        pending
          ? `Hi ${firstName(booking.fullName)}, thank you for requesting a meeting. I have reserved the time below for you and will confirm it by email shortly.`
          : `Hi ${firstName(booking.fullName)}, thank you for scheduling a meeting with me. Your meeting has been scheduled successfully, and I look forward to speaking with you. Here are the details:`,
        visitorRows(booking),
        [
          ["Add to Google Calendar", googleCalendarUrl(booking)],
          ["Reschedule", manage.replace(/\/booking\/.*$/, `/booking?reschedule=${booking.bookingToken}`)],
          ["Cancel booking", `${manage}?action=cancel`],
        ],
        "A calendar invitation (.ics) is attached. If your plans change, please use the links above to reschedule or cancel so the time can be offered to someone else. If you would like to share anything before we meet, simply reply to this email.",
      );
      return {
        to: booking.email,
        subject: `${pending ? "Requested" : "Confirmed"}: ${booking.meetingType.name} on ${when(booking, booking.visitorTimezone).date}`,
        text,
        html,
        ics: "PUBLISH",
      };
    }
    case "VISITOR_RESCHEDULED": {
      const { text, html } = render(
        "Your meeting has been rescheduled",
        `Hi ${firstName(booking.fullName)}, your meeting has been moved to a new time. The updated details are below, and the attached calendar invitation replaces the previous one.`,
        visitorRows(booking),
        [
          ["Add to Google Calendar", googleCalendarUrl(booking)],
          ["Reschedule", manage.replace(/\/booking\/.*$/, `/booking?reschedule=${booking.bookingToken}`)],
          ["Cancel booking", `${manage}?action=cancel`],
        ],
      );
      return {
        to: booking.email,
        subject: `Rescheduled: ${booking.meetingType.name} on ${when(booking, booking.visitorTimezone).date}`,
        text,
        html,
        ics: "PUBLISH",
      };
    }
    case "VISITOR_CANCELLED": {
      const { text, html } = render(
        "Your meeting has been cancelled",
        `Hi ${firstName(booking.fullName)}, this is to confirm that the meeting below has been cancelled.${booking.cancelReason ? ` Reason given: ${booking.cancelReason}` : ""}`,
        visitorRows(booking),
        [["Book a new time", manage.replace(/\/booking\/.*$/, "/booking")]],
        "If you would still like to talk, you are very welcome to choose another time that suits you.",
      );
      return { to: booking.email, subject: `Cancelled: ${booking.meetingType.name}`, text, html, ics: "CANCEL" };
    }
    case "ADMIN_NEW_BOOKING":
    case "ADMIN_CANCELLED": {
      const to = await adminAddress();
      if (!to) return null;
      const settings = await prisma.bookingSettings.findUnique({ where: { id: "default" } });
      const adminZone = settings?.timezone ?? booking.visitorTimezone;
      const mine = when(booking, adminZone);
      const theirs = when(booking, booking.visitorTimezone);
      const cancelled = kind === "ADMIN_CANCELLED";
      const { text, html } = render(
        cancelled ? `Meeting cancelled by ${booking.fullName}` : `New meeting booked with ${booking.fullName}`,
        cancelled
          ? `${booking.fullName} cancelled this meeting.${booking.cancelReason ? ` Reason: ${booking.cancelReason}` : " No reason was given."}`
          : `${booking.fullName} booked a meeting through your booking page. Status: ${booking.status.toLowerCase()}.`,
        [
          ["Meeting", booking.meetingType.name],
          ["Your time", `${mine.date}, ${mine.time} (${adminZone})`],
          ["Their time", `${theirs.date}, ${theirs.time} (${booking.visitorTimezone})`],
          ["Duration", mine.duration],
          ["Name", booking.fullName],
          ["Email", booking.email],
          ["Phone", booking.phone || "-"],
          ["Company", booking.company || "-"],
          ["Purpose", booking.purpose],
          ["Notes", booking.notes || "-"],
          ["Method", locationDescription(booking.locationType, booking.meetingType.locationDetail, booking.meetingUrl)],
          ["Reference", booking.reference],
        ],
        [["Open in admin", manage.replace(/\/booking\/.*$/, `/admin/booking/bookings/${booking.id}`)]],
        cancelled ? "The slot is open again on the booking page." : "Reply to this email to contact the attendee directly.",
        false,
      );
      return {
        to,
        replyTo: booking.email,
        subject: cancelled ? `Meeting cancelled by ${booking.fullName}` : `New meeting booked with ${booking.fullName}`,
        text,
        html,
      };
    }
    case "REMINDER": {
      const lead = offsetMinutes && offsetMinutes >= 60 ? durationLabel(offsetMinutes) : `${offsetMinutes ?? 15} minutes`;
      const { text, html } = render(
        `Reminder: our meeting starts in ${lead}`,
        `Hi ${firstName(booking.fullName)}, this is a friendly reminder about our upcoming meeting.`,
        visitorRows(booking),
        [
          ["Reschedule", manage.replace(/\/booking\/.*$/, `/booking?reschedule=${booking.bookingToken}`)],
          ["Cancel booking", `${manage}?action=cancel`],
        ],
        "If the time no longer works for you, please reschedule or cancel using the links above. See you soon.",
      );
      return { to: booking.email, subject: `Reminder: ${booking.meetingType.name} in ${lead}`, text, html };
    }
  }
}

async function deliver(notification: BookingNotification) {
  const booking = await prisma.booking.findUnique({
    where: { id: notification.bookingId },
    include: { meetingType: true },
  });
  if (!booking) return;
  if (notification.kind === "REMINDER" && !["CONFIRMED", "PENDING"].includes(booking.status)) {
    await prisma.bookingNotification.update({ where: { id: notification.id }, data: { sentAt: new Date(), lastError: "skipped: booking not active" } });
    return;
  }
  const apiKey = process.env.RESEND_API_KEY;
  try {
    const email = await compose(notification.kind, booking, notification.offsetMinutes);
    if (!email) throw new Error("No recipient configured");
    if (!apiKey) throw new Error("RESEND_API_KEY not set");
    const result = await new Resend(apiKey).emails.send({
      from: fromAddress(),
      to: email.to,
      replyTo: email.replyTo ?? process.env.CONTACT_EMAIL,
      subject: email.subject,
      text: email.text,
      html: email.html,
      ...(email.ics
        ? {
            attachments: [
              {
                filename: `${booking.reference}.ics`,
                content: Buffer.from(bookingIcs(booking, email.ics)).toString("base64"),
                contentType: "text/calendar",
              },
            ],
          }
        : {}),
    });
    if (result.error) throw new Error(`${result.error.name}: ${result.error.message}`);
    await prisma.bookingNotification.update({
      where: { id: notification.id },
      data: { sentAt: new Date(), attempts: { increment: 1 }, lastError: null },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email error";
    console.error(`Booking email ${notification.kind} not sent: ${message}`);
    await prisma.bookingNotification.update({
      where: { id: notification.id },
      data: { attempts: { increment: 1 }, lastError: message.slice(0, 300) },
    });
  }
}

/** Queues and immediately attempts the given emails. Never throws. */
export async function notify(bookingId: string, kinds: NotificationKind[]) {
  try {
    const now = new Date();
    const created = await Promise.all(
      kinds.map((kind) => prisma.bookingNotification.create({ data: { bookingId, kind, scheduledFor: now } })),
    );
    await Promise.all(created.map(deliver));
  } catch (error) {
    console.error("Booking notifications failed:", error instanceof Error ? error.message : error);
  }
}

/** Replaces the pending reminders of a booking with ones for its current time. */
export async function scheduleReminders(booking: Booking) {
  const settings = await prisma.bookingSettings.findUnique({ where: { id: "default" } });
  const offsets = settings?.reminderOffsets ?? [];
  await prisma.bookingNotification.deleteMany({ where: { bookingId: booking.id, kind: "REMINDER", sentAt: null } });
  const now = Date.now();
  const rows = offsets
    .map((offset) => ({ offset, at: new Date(booking.startTimeUTC.getTime() - offset * 60_000) }))
    .filter((r) => r.at.getTime() > now);
  if (rows.length)
    await prisma.bookingNotification.createMany({
      data: rows.map((r) => ({ bookingId: booking.id, kind: "REMINDER" as const, offsetMinutes: r.offset, scheduledFor: r.at })),
    });
}

/** Sends due reminders and retries failed emails (max 5 attempts). */
export async function processDueNotifications(limit = 50) {
  const due = await prisma.bookingNotification.findMany({
    where: { sentAt: null, scheduledFor: { lte: new Date() }, attempts: { lt: 5 } },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });
  for (const n of due) {
    // Skip reminders whose meeting already started (e.g. cron was down).
    if (n.kind === "REMINDER") {
      const booking = await prisma.booking.findUnique({ where: { id: n.bookingId }, select: { startTimeUTC: true } });
      if (!booking || booking.startTimeUTC.getTime() < Date.now()) {
        await prisma.bookingNotification.update({ where: { id: n.id }, data: { sentAt: new Date(), lastError: "skipped: meeting started" } });
        continue;
      }
    }
    await deliver(n);
  }
  return due.length;
}
