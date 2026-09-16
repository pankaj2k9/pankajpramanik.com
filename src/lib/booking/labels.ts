import type { BookingStatus, MeetingLocation } from "@prisma/client";

/** Display labels shared by the public pages, admin and emails. */

export const LOCATION_LABELS: Record<MeetingLocation, string> = {
  GOOGLE_MEET: "Google Meet",
  ZOOM: "Zoom",
  MICROSOFT_TEAMS: "Microsoft Teams",
  PHONE: "Phone call",
  CUSTOM_LINK: "Online meeting link",
};

export const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  RESCHEDULED: "Rescheduled",
  NO_SHOW: "No show",
};

/** Statuses that occupy their time slot. */
export const ACTIVE_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "COMPLETED", "NO_SHOW"];

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Stored in BookingNotification.lastError (with sentAt set) when Google
 * Calendar emailed the visitor instead of Resend.
 */
export const SENT_BY_GOOGLE = "google: sent by Google Calendar";

export const SLOT_TAKEN_MESSAGE = "This time slot was just booked. Please choose another available time.";

export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} hour${h === 1 ? "" : "s"}`;
}

/** What the attendee is told about joining, before a link exists. */
export function locationDescription(type: MeetingLocation, detail: string, meetingUrl?: string | null) {
  if (meetingUrl) return meetingUrl;
  switch (type) {
    case "PHONE":
      return detail ? `Phone call: ${detail}` : "Phone call - I will call the number you provide.";
    case "GOOGLE_MEET":
      return "Google Meet - the link is sent by email.";
    default:
      return detail || `${LOCATION_LABELS[type]} - the link is sent by email.`;
  }
}
