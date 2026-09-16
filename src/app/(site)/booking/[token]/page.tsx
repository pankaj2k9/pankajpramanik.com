import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHero from "@/components/inner/PageHero";
import CancelBooking from "@/components/booking/CancelBooking";
import { looksLikeToken } from "@/lib/booking/crypto";
import { googleCalendarUrl } from "@/lib/booking/ics";
import { durationLabel, LOCATION_LABELS, locationDescription, STATUS_LABELS } from "@/lib/booking/labels";
import { formatInZone, formatLongDate, formatTime } from "@/lib/booking/time";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your booking",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ManageBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string; action?: string }>;
}) {
  const { token } = await params;
  const { status, action } = await searchParams;
  if (!looksLikeToken(token)) notFound();
  const booking = await prisma.booking.findUnique({
    where: { bookingToken: token },
    include: { meetingType: true, rescheduledTo: { select: { bookingToken: true } } },
  });
  if (!booking) notFound();

  const tz = booking.visitorTimezone;
  const minutes = Math.round((booking.endTimeUTC.getTime() - booking.startTimeUTC.getTime()) / 60000);
  const upcoming = booking.startTimeUTC > new Date();
  const active = ["CONFIRMED", "PENDING"].includes(booking.status);
  const manageable = active && upcoming;
  const zoneAbbr = formatInZone(booking.startTimeUTC, tz, { timeZoneName: "short" }).split(" ").pop();

  const heading =
    booking.status === "CANCELLED"
      ? ["This meeting was cancelled."]
      : booking.status === "RESCHEDULED"
        ? ["This booking was moved."]
        : status === "scheduled"
          ? booking.status === "PENDING"
            ? ["Your request was received."]
            : ["Your meeting has been", "scheduled successfully."]
          : status === "rescheduled"
            ? ["Your meeting was", "rescheduled."]
            : ["Your booking."];

  return (
    <>
      <PageHero
        index="09"
        label="Booking"
        tone="mint"
        compact
        lines={heading as [string, string?]}
        lead={
          <p>
            {booking.status === "RESCHEDULED"
              ? "A newer time replaced this booking."
              : booking.status === "CANCELLED"
                ? "You can book a new time whenever it suits you."
                : booking.status === "PENDING"
                  ? `The time is held for you and will be confirmed by email. Reference ${booking.reference}.`
                  : `A confirmation with a calendar invite was sent to ${booking.email}. Reference ${booking.reference}.`}
          </p>
        }
      />
      <section className="ip-section bk-section">
        <div className="hm-container bk-confirm">
          <article className="ip-card bk-confirm-card" aria-labelledby="booking-details">
            <div className="bk-confirm-head">
              <span className={`bk-status is-${booking.status.toLowerCase()}`}>{STATUS_LABELS[booking.status]}</span>
              <h2 id="booking-details">{booking.meetingType.name}</h2>
            </div>
            <dl className="bk-confirm-list">
              <div>
                <dt>Date</dt>
                <dd>{formatLongDate(booking.startTimeUTC, tz)}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>
                  {formatTime(booking.startTimeUTC, tz)} - {formatTime(booking.endTimeUTC, tz)}
                </dd>
              </div>
              <div>
                <dt>Timezone</dt>
                <dd>
                  {tz.replace(/_/g, " ")} ({zoneAbbr})
                </dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>{durationLabel(minutes)}</dd>
              </div>
              <div>
                <dt>Attendee</dt>
                <dd>{booking.fullName}</dd>
              </div>
              <div>
                <dt>Meeting method</dt>
                <dd>
                  {LOCATION_LABELS[booking.locationType]}
                  <span className="bk-muted-block">
                    {booking.meetingUrl && active ? (
                      <a href={booking.meetingUrl} target="_blank" rel="noopener noreferrer">
                        Join link <span aria-hidden>↗</span>
                      </a>
                    ) : (
                      locationDescription(booking.locationType, booking.meetingType.locationDetail)
                    )}
                  </span>
                </dd>
              </div>
            </dl>

            {booking.status === "RESCHEDULED" && booking.rescheduledTo && (
              <div className="ct-actions">
                <Link className="hm-button" href={`/booking/${booking.rescheduledTo.bookingToken}`}>
                  View the new time <span aria-hidden>→</span>
                </Link>
              </div>
            )}

            {manageable && (
              <div className="ct-actions bk-confirm-actions">
                <a className="hm-button" href={googleCalendarUrl(booking)} target="_blank" rel="noopener noreferrer">
                  Add to Google Calendar <span aria-hidden>↗</span>
                </a>
                <a className="hm-link" href={`/api/booking/${token}/ics`} download>
                  Download .ics <span aria-hidden>↓</span>
                </a>
                <Link className="hm-link" href={`/booking?reschedule=${token}`}>
                  Reschedule <span aria-hidden>→</span>
                </Link>
                <CancelBooking token={token} openInitially={action === "cancel"} />
              </div>
            )}

            {manageable && action === "reschedule" && (
              <p className="bk-muted">
                <Link href={`/booking?reschedule=${token}`}>Choose a new time</Link> - your current slot stays booked until you confirm.
              </p>
            )}

            {(!active || !upcoming) && booking.status !== "RESCHEDULED" && (
              <div className="ct-actions">
                <Link className="hm-button" href="/booking">
                  Book another meeting <span aria-hidden>→</span>
                </Link>
              </div>
            )}
          </article>
        </div>
      </section>
    </>
  );
}
