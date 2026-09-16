import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getBookingSettings } from "@/lib/booking/service";
import { durationLabel, LOCATION_LABELS, STATUS_LABELS } from "@/lib/booking/labels";
import { dateKeyInZone, formatInZone, formatLongDate, formatTime, wallTimeInZone } from "@/lib/booking/time";
import {
  adminCancelBooking,
  adminRescheduleBooking,
  removeBookingAndReturn,
  updateBookingDetails,
} from "@/actions/booking";
import StatusBadge from "@/components/admin/booking/StatusBadge";
import BookingRowActions from "@/components/admin/booking/BookingRowActions";
import { ActionButton, ActionForm } from "@/components/admin/booking/ui";
import { inputCls, labelCls } from "@/components/admin/ui";

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [booking, settings] = await Promise.all([
    prisma.booking.findUnique({
      where: { id },
      include: {
        meetingType: true,
        rescheduledFrom: { select: { id: true, startTimeUTC: true } },
        rescheduledTo: { select: { id: true, startTimeUTC: true } },
        notifications: { orderBy: { scheduledFor: "asc" } },
      },
    }),
    getBookingSettings(),
  ]);
  if (!booking) notFound();
  const tz = settings.timezone;
  const now = new Date();
  const upcoming = booking.startTimeUTC > now;
  const active = ["CONFIRMED", "PENDING"].includes(booking.status);
  const minutes = Math.round((booking.endTimeUTC.getTime() - booking.startTimeUTC.getTime()) / 60000);

  return (
    <div className="max-w-5xl space-y-8">
      <div className="bka-head">
        <div>
          <p className="bka-muted">
            <Link href="/admin/booking/bookings" className="hover:underline">
              ← All bookings
            </Link>
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold">
            {booking.meetingType.name} with {booking.fullName}
          </h1>
          <p>
            {booking.reference} · <StatusBadge status={booking.status} />
          </p>
        </div>
        <BookingRowActions id={booking.id} status={booking.status} upcoming={upcoming} compact />
      </div>

      <section className="card p-6" aria-labelledby="details-title">
        <h2 id="details-title" className="bka-section-title mb-4">
          Details
        </h2>
        <dl className="bka-dl">
          <div>
            <dt>Your time ({tz})</dt>
            <dd>
              {formatLongDate(booking.startTimeUTC, tz)}
              <br />
              {formatTime(booking.startTimeUTC, tz)} - {formatTime(booking.endTimeUTC, tz)}
            </dd>
          </div>
          <div>
            <dt>Attendee time ({booking.visitorTimezone})</dt>
            <dd>
              {formatLongDate(booking.startTimeUTC, booking.visitorTimezone)}
              <br />
              {formatTime(booking.startTimeUTC, booking.visitorTimezone)} - {formatTime(booking.endTimeUTC, booking.visitorTimezone)}
            </dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>
              {durationLabel(minutes)} (+{booking.bufferBeforeMinutes} / {booking.bufferAfterMinutes} min buffer)
            </dd>
          </div>
          <div>
            <dt>Method</dt>
            <dd>
              {LOCATION_LABELS[booking.locationType]}
              {booking.meetingUrl && (
                <>
                  <br />
                  <a className="text-accent hover:underline" href={booking.meetingUrl} target="_blank" rel="noopener noreferrer">
                    {booking.meetingUrl}
                  </a>
                </>
              )}
            </dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>
              <a className="hover:underline" href={`mailto:${booking.email}`}>
                {booking.email}
              </a>
            </dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{booking.phone || "-"}</dd>
          </div>
          <div>
            <dt>Company</dt>
            <dd>{booking.company || "-"}</dd>
          </div>
          <div>
            <dt>Purpose</dt>
            <dd>{booking.purpose}</dd>
          </div>
          <div>
            <dt>Notes</dt>
            <dd className="whitespace-pre-wrap">{booking.notes || "-"}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{booking.source === "ADMIN" ? "Added by admin" : "Public booking page"}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{formatInZone(booking.createdAt, tz, { dateStyle: "medium", timeStyle: "short" })}</dd>
          </div>
          <div>
            <dt>Calendar event</dt>
            <dd>{booking.calendarEventId ? "Synced to Google Calendar" : "Not synced"}</dd>
          </div>
          {booking.cancelReason && (
            <div>
              <dt>Cancel reason</dt>
              <dd>{booking.cancelReason}</dd>
            </div>
          )}
          {booking.rescheduledFrom && (
            <div>
              <dt>Rescheduled from</dt>
              <dd>
                <Link className="text-accent hover:underline" href={`/admin/booking/bookings/${booking.rescheduledFrom.id}`}>
                  {formatInZone(booking.rescheduledFrom.startTimeUTC, tz, { dateStyle: "medium", timeStyle: "short" })}
                </Link>
              </dd>
            </div>
          )}
          {booking.rescheduledTo && (
            <div>
              <dt>Moved to</dt>
              <dd>
                <Link className="text-accent hover:underline" href={`/admin/booking/bookings/${booking.rescheduledTo.id}`}>
                  {formatInZone(booking.rescheduledTo.startTimeUTC, tz, { dateStyle: "medium", timeStyle: "short" })}
                </Link>
              </dd>
            </div>
          )}
        </dl>
        {active && (
          <p className="mt-5 text-sm">
            Attendee manage link:{" "}
            <a className="text-accent hover:underline" href={`/booking/${booking.bookingToken}`} target="_blank" rel="noopener noreferrer">
              open ↗
            </a>
          </p>
        )}
      </section>

      <section id="edit" className="card p-6" aria-labelledby="edit-title">
        <h2 id="edit-title" className="bka-section-title mb-4">
          Edit booking
        </h2>
        <ActionForm action={updateBookingDetails.bind(null, booking.id)} submitLabel="Save changes">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="fullName">Full name *</label>
              <input id="fullName" name="fullName" required defaultValue={booking.fullName} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="email">Email *</label>
              <input id="email" name="email" type="email" required defaultValue={booking.email} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="company">Company</label>
              <input id="company" name="company" defaultValue={booking.company ?? ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="phone">Phone</label>
              <input id="phone" name="phone" defaultValue={booking.phone ?? ""} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="purpose">Purpose *</label>
            <input id="purpose" name="purpose" required defaultValue={booking.purpose} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="notes">Attendee notes</label>
            <textarea id="notes" name="notes" rows={3} defaultValue={booking.notes ?? ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="meetingUrl">Meeting link</label>
            <input id="meetingUrl" name="meetingUrl" type="url" defaultValue={booking.meetingUrl ?? ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="adminNotes">Private admin notes</label>
            <textarea id="adminNotes" name="adminNotes" rows={3} defaultValue={booking.adminNotes ?? ""} className={inputCls} />
          </div>
        </ActionForm>
      </section>

      {active && (
        <div className="bka-grid-2">
          <section id="reschedule" className="card p-6" aria-labelledby="reschedule-title">
            <h2 id="reschedule-title" className="bka-section-title mb-4">
              Reschedule
            </h2>
            <ActionForm action={adminRescheduleBooking.bind(null, booking.id)} submitLabel="Move booking">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls} htmlFor="rs-date">Date ({tz})</label>
                  <input id="rs-date" name="date" type="date" required defaultValue={dateKeyInZone(booking.startTimeUTC, tz)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="rs-time">Start time</label>
                  <input id="rs-time" name="time" type="time" required step={300} defaultValue={wallTimeInZone(booking.startTimeUTC, tz)} className={inputCls} />
                </div>
              </div>
              <label className="bka-check">
                <input type="checkbox" name="override" /> Ignore working hours and notice (still prevents overlaps)
              </label>
              <label className="bka-check">
                <input type="checkbox" name="notify" defaultChecked /> Email the attendee
              </label>
            </ActionForm>
          </section>
          <section className="card p-6" aria-labelledby="cancel-title">
            <h2 id="cancel-title" className="bka-section-title mb-4">
              Cancel
            </h2>
            <ActionForm action={adminCancelBooking.bind(null, booking.id)} submitLabel="Cancel booking">
              <div>
                <label className={labelCls} htmlFor="reason">Reason (shared with attendee)</label>
                <textarea id="reason" name="reason" rows={3} maxLength={500} className={inputCls} />
              </div>
              <label className="bka-check">
                <input type="checkbox" name="notify" defaultChecked /> Email the attendee
              </label>
            </ActionForm>
          </section>
        </div>
      )}

      <section className="card p-6" aria-labelledby="emails-title">
        <h2 id="emails-title" className="bka-section-title mb-2">
          Emails & reminders
        </h2>
        {booking.notifications.length === 0 ? (
          <p className="bka-muted">None.</p>
        ) : (
          <ul className="bka-list">
            {booking.notifications.map((n) => (
              <li key={n.id}>
                <span>
                  {n.kind.replace(/_/g, " ").toLowerCase()}
                  {n.offsetMinutes ? ` (${durationLabel(n.offsetMinutes)} before)` : ""}
                </span>
                <span className="bka-muted">
                  {n.sentAt
                    ? `${n.lastError?.startsWith("skipped") ? "Skipped" : "Sent"} ${formatInZone(n.sentAt, tz, { dateStyle: "medium", timeStyle: "short" })}`
                    : n.lastError
                      ? `Failed (${n.attempts}×): ${n.lastError}`
                      : `Scheduled ${formatInZone(n.scheduledFor, tz, { dateStyle: "medium", timeStyle: "short" })}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-6">
        <h2 className="bka-section-title mb-2">Delete</h2>
        <p className="bka-muted mb-3">
          Removes the record permanently without emailing anyone. Current status: {STATUS_LABELS[booking.status]}.
        </p>
        <ActionButton
          label="Delete booking"
          tone="danger"
          confirmText="Delete this booking permanently?"
          action={removeBookingAndReturn.bind(null, booking.id)}
        />
      </section>
    </div>
  );
}
