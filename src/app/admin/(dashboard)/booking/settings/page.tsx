import { requireAdmin } from "@/lib/auth";
import { getBookingSettings } from "@/lib/booking/service";
import { getGoogleConnection, googleRedirectUri, isGoogleConfigured } from "@/lib/booking/google";
import { durationLabel } from "@/lib/booking/labels";
import { listTimeZones, offsetLabel } from "@/lib/booking/time";
import { disconnectGoogleCalendar, saveBookingSettings } from "@/actions/booking";
import { ActionButton, ActionForm } from "@/components/admin/booking/ui";
import { inputCls, labelCls } from "@/components/admin/ui";

const REMINDER_CHOICES = [10080, 2880, 1440, 180, 60, 30, 15];
const GOOGLE_MESSAGES: Record<string, string> = {
  connected: "Google Calendar connected.",
  denied: "Google access was not granted.",
  "invalid-state": "The Google sign-in expired or did not match. Try again.",
  error: "Google Calendar could not be connected. Check the server logs and OAuth settings.",
  "not-configured": "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server first.",
};

export default async function BookingSettingsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  await requireAdmin();
  const { google: googleResult } = await searchParams;
  const [settings, google] = await Promise.all([getBookingSettings(), getGoogleConnection()]);
  const now = new Date();

  return (
    <div className="max-w-4xl space-y-6">
      <div className="bka-head">
        <div>
          <h1 className="font-display text-2xl font-bold">Booking settings</h1>
          <p>Timezone, notifications and calendar integration.</p>
        </div>
      </div>

      {googleResult && GOOGLE_MESSAGES[googleResult] && (
        <p role="status" className="card p-4 text-sm">
          {GOOGLE_MESSAGES[googleResult]}
        </p>
      )}

      <ActionForm action={saveBookingSettings} submitLabel="Save settings" className="space-y-6">
        <section className="card space-y-5 p-6" aria-labelledby="general-title">
          <h2 id="general-title" className="bka-section-title">
            General
          </h2>
          <div>
            <label className={labelCls} htmlFor="timezone">Primary timezone *</label>
            <select id="timezone" name="timezone" defaultValue={settings.timezone} className={inputCls}>
              {listTimeZones().map((z) => (
                <option key={z} value={z}>
                  {z} ({offsetLabel(z, now)})
                </option>
              ))}
            </select>
            <p className="bka-muted mt-1">Weekly hours, breaks and admin dates are read in this timezone. Stored bookings are UTC and never move.</p>
          </div>
          <label className="bka-check">
            <input type="checkbox" name="bookingEnabled" defaultChecked={settings.bookingEnabled} /> Accept new bookings on /booking
          </label>
          <label className="bka-check">
            <input type="checkbox" name="requireApproval" defaultChecked={settings.requireApproval} /> New public bookings start as Pending (approve them in Bookings)
          </label>
        </section>

        <section className="card space-y-5 p-6" aria-labelledby="notify-title">
          <h2 id="notify-title" className="bka-section-title">
            Notifications
          </h2>
          <div>
            <label className={labelCls} htmlFor="notifyEmail">Admin notification email</label>
            <input
              id="notifyEmail"
              name="notifyEmail"
              type="email"
              defaultValue={settings.notifyEmail}
              placeholder={process.env.CONTACT_EMAIL ?? "you@example.com"}
              className={inputCls}
            />
            <p className="bka-muted mt-1">Empty = CONTACT_EMAIL. Emails use the existing Resend setup{process.env.RESEND_API_KEY ? "" : " (RESEND_API_KEY is not set here)"}.</p>
          </div>
          <fieldset>
            <legend className={labelCls}>Attendee reminders</legend>
            <div className="flex flex-wrap gap-5">
              {REMINDER_CHOICES.map((m) => (
                <label key={m} className="bka-check">
                  <input type="checkbox" name="reminderOffsets" value={m} defaultChecked={settings.reminderOffsets.includes(m)} />
                  {durationLabel(m)} before
                </label>
              ))}
            </div>
            <p className="bka-muted mt-2">
              Sent by <code>/api/cron/booking-reminders</code> - schedule it every 5 minutes with the CRON_SECRET bearer token.
              {process.env.CRON_SECRET ? "" : " CRON_SECRET is not set here."}
            </p>
          </fieldset>
        </section>

        <section className="card space-y-5 p-6" aria-labelledby="google-title">
          <h2 id="google-title" className="bka-section-title">
            Google Calendar
          </h2>
          {!isGoogleConfigured() ? (
            <div className="bka-muted space-y-2">
              <p>Not configured. To enable it:</p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Create an OAuth client (Web application) in Google Cloud and enable the Google Calendar API.</li>
                <li>
                  Add the redirect URI <code>{googleRedirectUri()}</code>.
                </li>
                <li>Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and BOOKING_ENCRYPTION_KEY on the server, then restart.</li>
              </ol>
            </div>
          ) : google ? (
            <>
              <p className="text-sm">
                Connected as <strong>{google.accountEmail || "Google account"}</strong>
                {google.lastError && <span className="block text-pink">Last error: {google.lastError}</span>}
              </p>
              <div>
                <label className={labelCls} htmlFor="calendarId">Calendar ID</label>
                <input id="calendarId" name="calendarId" defaultValue={google.calendarId} className={inputCls} />
              </div>
              <label className="bka-check">
                <input type="checkbox" name="checkBusy" defaultChecked={google.checkBusy} /> Hide times that are busy in Google Calendar (free/busy only, no event details)
              </label>
              <label className="bka-check">
                <input type="checkbox" name="createEvents" defaultChecked={google.createEvents} /> Create, move and delete events for bookings
              </label>
              <label className="bka-check">
                <input type="checkbox" name="createMeetLinks" defaultChecked={google.createMeetLinks} /> Generate Google Meet links for Google Meet meeting types
              </label>
              <label className="bka-check">
                <input type="checkbox" name="sendGoogleInvites" defaultChecked={google.sendGoogleInvites} /> Also let Google Calendar email its own invitation and updates to the attendee
              </label>
              <p className="bka-muted">
                The site always sends its own confirmation (with reschedule and cancel links) to the attendee and a notification to you. Google&apos;s
                invitation adds an Accept/Decline calendar invite; enable it if you want both.
              </p>
            </>
          ) : (
            <p className="text-sm">
              Not connected.{" "}
              <a className="text-accent hover:underline" href="/api/admin/booking/google/connect">
                Connect Google Calendar →
              </a>
            </p>
          )}
        </section>
      </ActionForm>

      {google && (
        <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
          <p className="bka-muted">Disconnecting revokes access and deletes the stored tokens. Existing events stay in Google Calendar.</p>
          <div className="flex gap-4">
            <a className="text-sm text-accent hover:underline" href="/api/admin/booking/google/connect">
              Reconnect
            </a>
            <ActionButton label="Disconnect" tone="danger" confirmText="Disconnect Google Calendar?" action={disconnectGoogleCalendar} />
          </div>
        </div>
      )}
    </div>
  );
}
