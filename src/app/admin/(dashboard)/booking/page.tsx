import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getBookingSettings } from "@/lib/booking/service";
import { getGoogleConnection, isGoogleConfigured } from "@/lib/booking/google";
import { addDays, dateKeyInZone, formatInZone, formatTime, startOfDayUtc } from "@/lib/booking/time";
import StatusBadge from "@/components/admin/booking/StatusBadge";
import CopyLink from "@/components/admin/booking/CopyLink";
import { absoluteUrl } from "@/lib/site";

export default async function BookingDashboard() {
  await requireAdmin();
  const settings = await getBookingSettings();
  const tz = settings.timezone;
  const now = new Date();
  const today = dateKeyInZone(now, tz);
  const dayStart = startOfDayUtc(today, tz);
  const dayEnd = startOfDayUtc(addDays(today, 1), tz);
  const active = { in: ["CONFIRMED", "PENDING"] as ("CONFIRMED" | "PENDING")[] };

  const [todays, upcomingCount, total, cancelled, completed, pending, next, google, failedEmails] = await Promise.all([
    prisma.booking.findMany({
      where: { startTimeUTC: { gte: dayStart, lt: dayEnd }, status: { notIn: ["RESCHEDULED"] } },
      include: { meetingType: true },
      orderBy: { startTimeUTC: "asc" },
    }),
    prisma.booking.count({ where: { startTimeUTC: { gte: now }, status: active } }),
    prisma.booking.count({ where: { status: { not: "RESCHEDULED" } } }),
    prisma.booking.count({ where: { status: "CANCELLED" } }),
    prisma.booking.count({ where: { status: "COMPLETED" } }),
    prisma.booking.count({ where: { status: "PENDING", startTimeUTC: { gte: now } } }),
    prisma.booking.findMany({
      where: { startTimeUTC: { gte: now }, status: active },
      include: { meetingType: true },
      orderBy: { startTimeUTC: "asc" },
      take: 8,
    }),
    getGoogleConnection(),
    prisma.bookingNotification.count({ where: { sentAt: null, lastError: { not: null } } }),
  ]);
  const shareTypes = await prisma.meetingType.findMany({ where: { active: true }, orderBy: [{ order: "asc" }, { durationMinutes: "asc" }] });

  const stats = [
    { label: "Today's bookings", value: todays.filter((b) => b.status !== "CANCELLED").length, href: `/admin/booking/calendar?view=day&date=${today}` },
    { label: "Upcoming", value: upcomingCount, hint: pending ? `${pending} pending approval` : undefined, href: "/admin/booking/bookings?range=upcoming" },
    { label: "Total bookings", value: total, href: "/admin/booking/bookings?range=all" },
    { label: "Cancelled", value: cancelled, href: "/admin/booking/bookings?range=all&status=CANCELLED" },
    { label: "Completed", value: completed, href: "/admin/booking/bookings?range=all&status=COMPLETED" },
  ];

  return (
    <div className="space-y-8">
      <div className="bka-head">
        <div>
          <h1 className="font-display text-2xl font-bold">Bookings</h1>
          <p>
            Times in {tz}. Public page: <Link className="text-accent hover:underline" href="/booking">/booking</Link>
            {!settings.bookingEnabled && " (paused)"}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="bka-button-ghost" href="/admin/booking/calendar">
            Open calendar
          </Link>
          <Link className="bka-button" href="/admin/booking/bookings/new">
            + Add booking
          </Link>
        </div>
      </div>

      <div className="bka-stats">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card card-hover bka-stat">
            <p>{s.label}</p>
            <strong>{s.value}</strong>
            {s.hint && <p className="bka-muted mt-1">{s.hint}</p>}
          </Link>
        ))}
      </div>

      {(failedEmails > 0 || !process.env.RESEND_API_KEY || (isGoogleConfigured() && !google)) && (
        <ul className="card space-y-1 p-5 text-sm">
          {!process.env.RESEND_API_KEY && <li>Email is not configured (RESEND_API_KEY). Bookings still work, but no confirmations are sent.</li>}
          {failedEmails > 0 && <li>{failedEmails} booking email{failedEmails === 1 ? "" : "s"} failed and will be retried by the reminder job.</li>}
          {isGoogleConfigured() && !google && (
            <li>
              Google Calendar is not connected. <Link className="text-accent hover:underline" href="/admin/booking/settings">Connect it in settings</Link>.
            </li>
          )}
        </ul>
      )}

      <section className="card p-5" aria-labelledby="share-title">
        <h2 id="share-title" className="bka-section-title">
          Share your booking link
        </h2>
        <p className="bka-muted mt-1">
          Send these to clients. Visitors only see open times from your{" "}
          <Link className="text-accent hover:underline" href="/admin/booking/availability">availability</Link>
          {google?.checkBusy ? `, minus busy times in Google Calendar (${google.accountEmail})` : ""}.
        </p>
        <div className="mt-3">
          <CopyLink label="All meeting types" url={absoluteUrl("/booking")} />
          <CopyLink label="Short link" url={absoluteUrl("/book")} />
          {shareTypes.map((t) => (
            <CopyLink key={t.id} label={t.name} url={absoluteUrl(`/booking?type=${t.slug}`)} />
          ))}
        </div>
      </section>

      <div className="bka-grid-2">
        <section className="card p-5" aria-labelledby="today-title">
          <h2 id="today-title" className="bka-section-title">
            Today · {formatInZone(now, tz, { weekday: "long", month: "short", day: "numeric" })}
          </h2>
          {todays.length === 0 ? (
            <p className="bka-muted mt-3">No meetings today.</p>
          ) : (
            <ul className="bka-list mt-2">
              {todays.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/booking/bookings/${b.id}`} className="hover:underline">
                    <strong>{formatTime(b.startTimeUTC, tz)}</strong> {b.fullName}
                    <span className="bka-muted"> · {b.meetingType.name}</span>
                  </Link>
                  <StatusBadge status={b.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-5" aria-labelledby="next-title">
          <h2 id="next-title" className="bka-section-title">
            Upcoming
          </h2>
          {next.length === 0 ? (
            <p className="bka-muted mt-3">Nothing scheduled.</p>
          ) : (
            <ul className="bka-list mt-2">
              {next.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/booking/bookings/${b.id}`} className="hover:underline">
                    <strong>{formatInZone(b.startTimeUTC, tz, { weekday: "short", month: "short", day: "numeric" })}</strong>{" "}
                    {formatTime(b.startTimeUTC, tz)} · {b.fullName}
                    <span className="bka-muted"> · {b.meetingType.name}</span>
                  </Link>
                  <StatusBadge status={b.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
