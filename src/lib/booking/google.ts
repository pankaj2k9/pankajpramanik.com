import { createHash } from "node:crypto";
import type { Booking, CalendarConnection, MeetingType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { absoluteUrl, site } from "@/lib/site";
import { decryptSecret, encryptSecret } from "./crypto";
import type { Interval } from "./availability";
import { manageUrl } from "./ics";
import { locationDescription } from "./labels";

/**
 * Google Calendar provider. Server-only: client id/secret come from the
 * environment and tokens are stored encrypted in CalendarConnection.
 *
 * Every public function degrades to a no-op when Google is not configured or
 * not connected, so bookings never depend on Google being reachable.
 */

const PROVIDER = "google";
const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
];
const API = "https://www.googleapis.com/calendar/v3";

export const googleRedirectUri = () => absoluteUrl("/api/admin/booking/google/callback");

export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      ...body,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google token request failed (${res.status})`);
  return res.json();
}

/** Completes OAuth and stores (or replaces) the connection. */
export async function connectGoogle(code: string) {
  const tokens = await tokenRequest({
    code,
    grant_type: "authorization_code",
    redirect_uri: googleRedirectUri(),
  });
  if (!tokens.refresh_token)
    throw new Error("Google did not return a refresh token. Remove the app's access in your Google account and connect again.");
  const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    cache: "no-store",
  });
  const email = info.ok ? ((await info.json()) as { email?: string }).email ?? "" : "";
  const data = {
    accountEmail: email,
    accessTokenEnc: encryptSecret(tokens.access_token),
    refreshTokenEnc: encryptSecret(tokens.refresh_token),
    expiresAt: new Date(Date.now() + (tokens.expires_in - 60) * 1000),
    scope: tokens.scope ?? SCOPES.join(" "),
    lastError: null,
  };
  await prisma.calendarConnection.upsert({
    where: { provider: PROVIDER },
    create: { provider: PROVIDER, ...data },
    update: { ...data, connectedAt: new Date() },
  });
}

export async function disconnectGoogle() {
  const conn = await prisma.calendarConnection.findUnique({ where: { provider: PROVIDER } });
  if (!conn) return;
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decryptSecret(conn.refreshTokenEnc))}`, {
      method: "POST",
      cache: "no-store",
    });
  } catch {
    // Revocation is best effort; the stored tokens are deleted regardless.
  }
  await prisma.calendarConnection.delete({ where: { provider: PROVIDER } });
}

export async function getGoogleConnection() {
  if (!isGoogleConfigured()) return null;
  return prisma.calendarConnection.findUnique({ where: { provider: PROVIDER } });
}

async function accessToken(conn: CalendarConnection): Promise<string> {
  if (conn.expiresAt.getTime() > Date.now()) return decryptSecret(conn.accessTokenEnc);
  const tokens = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: decryptSecret(conn.refreshTokenEnc),
  });
  await prisma.calendarConnection.update({
    where: { id: conn.id },
    data: {
      accessTokenEnc: encryptSecret(tokens.access_token),
      expiresAt: new Date(Date.now() + (tokens.expires_in - 60) * 1000),
      ...(tokens.refresh_token ? { refreshTokenEnc: encryptSecret(tokens.refresh_token) } : {}),
      lastError: null,
    },
  });
  return tokens.access_token;
}

async function googleFetch(conn: CalendarConnection, path: string, init: RequestInit = {}) {
  const token = await accessToken(conn);
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok && res.status !== 410 && res.status !== 404) {
    const message = `Google Calendar ${init.method ?? "GET"} ${path.split("?")[0]} failed (${res.status})`;
    await prisma.calendarConnection
      .update({ where: { id: conn.id }, data: { lastError: message } })
      .catch(() => undefined);
    throw new Error(message);
  }
  return res;
}

const busyCache = new Map<string, { at: number; value: Interval[] }>();

/**
 * Busy periods only (no titles or details) for the given window. Cached for a
 * minute to keep the booking page fast; the booking transaction bypasses it.
 */
export async function googleBusy(start: Date, end: Date, { fresh = false } = {}): Promise<Interval[]> {
  const conn = await getGoogleConnection();
  if (!conn?.checkBusy) return [];
  const key = `${conn.calendarId}|${start.toISOString()}|${end.toISOString()}`;
  const cached = busyCache.get(key);
  if (!fresh && cached && Date.now() - cached.at < 60_000) return cached.value;
  try {
    const res = await googleFetch(conn, "/freeBusy", {
      method: "POST",
      body: JSON.stringify({
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        items: [{ id: conn.calendarId }],
      }),
    });
    const json = (await res.json()) as {
      calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
    };
    const value = (json.calendars?.[conn.calendarId]?.busy ?? []).map((b) => ({
      start: Date.parse(b.start),
      end: Date.parse(b.end),
    }));
    busyCache.set(key, { at: Date.now(), value });
    if (busyCache.size > 200) busyCache.delete(busyCache.keys().next().value!);
    return value;
  } catch (error) {
    console.error("Google free/busy lookup failed:", error instanceof Error ? error.message : error);
    return [];
  }
}

export function clearBusyCache() {
  busyCache.clear();
}

type BookingWithType = Booking & { meetingType: MeetingType };

/**
 * Result of writing a booking to Google Calendar. `attendeeNotified` is true
 * only when Google accepted the write with sendUpdates=all and the visitor is
 * an attendee of the event, i.e. Google has emailed them the invitation,
 * update or cancellation. Callers use it to skip the matching Resend email.
 */
export type CalendarSyncResult = { eventId: string; meetingUrl: string | null; attendeeNotified: boolean };

type GoogleEvent = {
  id: string;
  status?: string;
  hangoutLink?: string;
  attendees?: { email?: string }[];
};

/**
 * Deterministic event id (hex is valid base32hex), so a create that timed out
 * after Google stored the event can be detected instead of sending a second
 * confirmation through Resend.
 */
const eventIdFor = (booking: Booking) => createHash("sha256").update(`booking:${booking.id}`).digest("hex").slice(0, 40);

/** Pending requests hold the time in the admin calendar but invite nobody until approved. */
const invitesAttendee = (booking: Booking) => booking.status === "CONFIRMED";

const sendUpdates = (notify: boolean) => (notify ? "all" : "none");

const hasAttendee = (event: GoogleEvent, email: string) =>
  (event.attendees ?? []).some((a) => a.email?.toLowerCase() === email.toLowerCase());

function toResult(event: GoogleEvent, booking: Booking, notify: boolean): CalendarSyncResult {
  return {
    eventId: event.id,
    meetingUrl: event.hangoutLink ?? null,
    attendeeNotified: notify && event.status !== "cancelled" && hasAttendee(event, booking.email),
  };
}

function eventSummary(booking: BookingWithType) {
  return `${booking.status === "PENDING" ? "Pending: " : ""}${booking.meetingType.name} with ${booking.fullName}`;
}

function eventDescription(booking: BookingWithType) {
  const forVisitor = [
    `Booked via ${absoluteUrl("/booking")}`,
    `Reference: ${booking.reference}`,
    `Join: ${locationDescription(booking.locationType, booking.meetingType.locationDetail, booking.meetingUrl)}`,
    `Reschedule or cancel: ${manageUrl(booking.bookingToken)}`,
  ];
  const details = [
    `Attendee: ${booking.fullName} <${booking.email}>`,
    booking.company ? `Company: ${booking.company}` : "",
    booking.phone ? `Phone: ${booking.phone}` : "",
    `Purpose: ${booking.purpose}`,
    booking.notes ? `Notes: ${booking.notes}` : "",
  ].filter(Boolean);
  return `${forVisitor.join("\n")}\n\n${details.join("\n")}`;
}

const attendeeList = (booking: Booking) =>
  invitesAttendee(booking) ? [{ email: booking.email, displayName: booking.fullName }] : [];

function eventBody(booking: BookingWithType, withMeet: boolean) {
  return {
    id: eventIdFor(booking),
    summary: eventSummary(booking),
    description: eventDescription(booking),
    start: { dateTime: booking.startTimeUTC.toISOString(), timeZone: "UTC" },
    end: { dateTime: booking.endTimeUTC.toISOString(), timeZone: "UTC" },
    attendees: attendeeList(booking),
    guestsCanModify: false,
    location: booking.locationType === "GOOGLE_MEET" ? undefined : booking.meetingType.locationDetail || undefined,
    reminders: { useDefault: true },
    ...(withMeet
      ? {
          conferenceData: {
            createRequest: {
              requestId: booking.bookingToken.slice(0, 32),
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        }
      : {}),
    source: { title: `${site.name} booking`, url: absoluteUrl("/booking") },
  };
}

const eventsPath = (conn: CalendarConnection) => `/calendars/${encodeURIComponent(conn.calendarId)}/events`;

async function getEvent(conn: CalendarConnection, eventId: string): Promise<GoogleEvent | null> {
  const res = await googleFetch(conn, `${eventsPath(conn)}/${encodeURIComponent(eventId)}`);
  if (res.status === 404 || res.status === 410) return null;
  const event = (await res.json()) as GoogleEvent;
  return event.status === "cancelled" ? null : event;
}

/**
 * Creates the event (and a Meet link when asked). Confirmed bookings get the
 * visitor as attendee and, when `notify`, Google emails them the invitation.
 * Returns null when Google is not connected or event creation is disabled.
 */
export async function createGoogleEvent(
  booking: BookingWithType,
  { notify }: { notify: boolean },
): Promise<CalendarSyncResult | null> {
  const conn = await getGoogleConnection();
  if (!conn?.createEvents) return null;
  const withMeet = booking.locationType === "GOOGLE_MEET" && conn.createMeetLinks;
  const shouldNotify = notify && invitesAttendee(booking);
  try {
    const res = await googleFetch(
      conn,
      `${eventsPath(conn)}?sendUpdates=${sendUpdates(shouldNotify)}${withMeet ? "&conferenceDataVersion=1" : ""}`,
      { method: "POST", body: JSON.stringify(eventBody(booking, withMeet)) },
    );
    return toResult((await res.json()) as GoogleEvent, booking, shouldNotify);
  } catch (error) {
    // A timeout or 409 may mean Google stored the event (and emailed the
    // invitation) anyway; report that instead of letting Resend send another.
    const existing = await getEvent(conn, eventIdFor(booking)).catch(() => null);
    if (existing) return toResult(existing, booking, shouldNotify);
    throw error;
  }
}

/**
 * Moves an existing event and refreshes its details. Confirmed bookings get
 * the visitor as attendee, so an approval or reschedule makes Google send the
 * invitation or update. Returns null when there is no event to update.
 */
export async function updateGoogleEvent(
  booking: BookingWithType,
  { notify }: { notify: boolean },
): Promise<CalendarSyncResult | null> {
  const conn = await getGoogleConnection();
  if (!conn?.createEvents || !booking.calendarEventId) return null;
  const shouldNotify = notify && invitesAttendee(booking);
  const res = await googleFetch(
    conn,
    `${eventsPath(conn)}/${encodeURIComponent(booking.calendarEventId)}?sendUpdates=${sendUpdates(shouldNotify)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        summary: eventSummary(booking),
        description: eventDescription(booking),
        start: { dateTime: booking.startTimeUTC.toISOString(), timeZone: "UTC" },
        end: { dateTime: booking.endTimeUTC.toISOString(), timeZone: "UTC" },
        ...(invitesAttendee(booking) ? { attendees: attendeeList(booking), guestsCanModify: false } : {}),
      }),
    },
  );
  if (res.status === 404 || res.status === 410) return null;
  const event = (await res.json()) as GoogleEvent;
  if (event.status === "cancelled") return null;
  return toResult(event, booking, shouldNotify);
}

/**
 * Deletes the event. With `notify`, Google emails the cancellation to the
 * attendee; `attendeeNotified` says whether the visitor was on the event and
 * so actually received it.
 */
export async function deleteGoogleEvent(
  eventId: string | null,
  { notify = false, attendeeEmail }: { notify?: boolean; attendeeEmail?: string } = {},
): Promise<{ attendeeNotified: boolean }> {
  if (!eventId) return { attendeeNotified: false };
  const conn = await getGoogleConnection();
  if (!conn) return { attendeeNotified: false };
  // Only let Google email the cancellation when we can tell the visitor is on
  // the event; otherwise delete silently and the caller sends it via Resend.
  const event = notify ? await getEvent(conn, eventId).catch(() => null) : null;
  const viaGoogle = Boolean(event && attendeeEmail && hasAttendee(event, attendeeEmail));
  const res = await googleFetch(conn, `${eventsPath(conn)}/${encodeURIComponent(eventId)}?sendUpdates=${sendUpdates(viaGoogle)}`, {
    method: "DELETE",
  });
  const deleted = res.status !== 404 && res.status !== 410;
  return { attendeeNotified: viaGoogle && deleted };
}
