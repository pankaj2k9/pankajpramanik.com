import type { Booking, CalendarConnection, MeetingType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { absoluteUrl, site } from "@/lib/site";
import { decryptSecret, encryptSecret } from "./crypto";
import type { Interval } from "./availability";

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

/** Google emails the attendee itself only when the admin opted in. */
const updates = (conn: CalendarConnection) => (conn.sendGoogleInvites ? "all" : "none");

function eventBody(booking: BookingWithType, withMeet: boolean) {
  const lines = [
    `Booked via ${absoluteUrl("/booking")}`,
    `Reference: ${booking.reference}`,
    `Attendee: ${booking.fullName} <${booking.email}>`,
    booking.company ? `Company: ${booking.company}` : "",
    booking.phone ? `Phone: ${booking.phone}` : "",
    `Purpose: ${booking.purpose}`,
    booking.notes ? `Notes: ${booking.notes}` : "",
  ].filter(Boolean);
  return {
    summary: `${booking.meetingType.name} with ${booking.fullName}`,
    description: lines.join("\n"),
    start: { dateTime: booking.startTimeUTC.toISOString(), timeZone: "UTC" },
    end: { dateTime: booking.endTimeUTC.toISOString(), timeZone: "UTC" },
    attendees: [{ email: booking.email, displayName: booking.fullName }],
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

/** Creates the event (and a Meet link when asked). Returns ids to store. */
export async function createGoogleEvent(booking: BookingWithType) {
  const conn = await getGoogleConnection();
  if (!conn?.createEvents) return null;
  const withMeet = booking.locationType === "GOOGLE_MEET" && conn.createMeetLinks;
  const res = await googleFetch(
    conn,
    `/calendars/${encodeURIComponent(conn.calendarId)}/events?sendUpdates=${updates(conn)}${withMeet ? "&conferenceDataVersion=1" : ""}`,
    { method: "POST", body: JSON.stringify(eventBody(booking, withMeet)) },
  );
  const event = (await res.json()) as { id: string; hangoutLink?: string };
  return { eventId: event.id, meetingUrl: event.hangoutLink ?? null };
}

export async function updateGoogleEvent(booking: BookingWithType) {
  const conn = await getGoogleConnection();
  if (!conn?.createEvents || !booking.calendarEventId) return null;
  const res = await googleFetch(
    conn,
    `/calendars/${encodeURIComponent(conn.calendarId)}/events/${encodeURIComponent(booking.calendarEventId)}?sendUpdates=${updates(conn)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        summary: `${booking.meetingType.name} with ${booking.fullName}`,
        description: eventBody(booking, false).description,
        start: { dateTime: booking.startTimeUTC.toISOString(), timeZone: "UTC" },
        end: { dateTime: booking.endTimeUTC.toISOString(), timeZone: "UTC" },
      }),
    },
  );
  if (res.status === 404 || res.status === 410) return null;
  const event = (await res.json()) as { id: string; hangoutLink?: string };
  return { eventId: event.id, meetingUrl: event.hangoutLink ?? null };
}

export async function deleteGoogleEvent(eventId: string | null) {
  if (!eventId) return;
  const conn = await getGoogleConnection();
  if (!conn) return;
  await googleFetch(
    conn,
    `/calendars/${encodeURIComponent(conn.calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=${updates(conn)}`,
    { method: "DELETE" },
  );
}
