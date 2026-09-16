import type { Booking, MeetingType } from "@prisma/client";
import { absoluteUrl, site } from "@/lib/site";
import { LOCATION_LABELS, locationDescription } from "./labels";

type BookingWithType = Booking & { meetingType: MeetingType };

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

/** RFC 5545 lines are limited to 75 octets; continuation lines start with a space. */
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut)) > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

export const manageUrl = (token: string) => absoluteUrl(`/booking/${token}`);

function details(booking: BookingWithType) {
  return [
    `${booking.meetingType.name} with ${site.name}`,
    `Join: ${locationDescription(booking.locationType, booking.meetingType.locationDetail, booking.meetingUrl)}`,
    `Reference: ${booking.reference}`,
    `Reschedule or cancel: ${manageUrl(booking.bookingToken)}`,
  ].join("\n");
}

export function bookingIcs(booking: BookingWithType, method: "PUBLISH" | "CANCEL" = "PUBLISH") {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//pankajpramanik.com//Booking//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${booking.reference}@pankajpramanik.com`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(booking.startTimeUTC)}`,
    `DTEND:${stamp(booking.endTimeUTC)}`,
    `SUMMARY:${escapeText(`${booking.meetingType.name} with ${site.name}`)}`,
    `DESCRIPTION:${escapeText(details(booking))}`,
    `LOCATION:${escapeText(booking.meetingUrl ?? LOCATION_LABELS[booking.locationType])}`,
    `ORGANIZER;CN=${escapeText(site.name)}:mailto:${site.businessEmail}`,
    `STATUS:${method === "CANCEL" || booking.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED"}`,
    `URL:${manageUrl(booking.bookingToken)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Meeting reminder",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

export function googleCalendarUrl(booking: BookingWithType) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${booking.meetingType.name} with ${site.name}`,
    dates: `${stamp(booking.startTimeUTC)}/${stamp(booking.endTimeUTC)}`,
    details: details(booking),
    location: booking.meetingUrl ?? LOCATION_LABELS[booking.locationType],
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
