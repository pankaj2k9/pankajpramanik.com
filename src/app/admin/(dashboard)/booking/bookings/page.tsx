import Link from "next/link";
import type { BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getBookingSettings } from "@/lib/booking/service";
import { STATUS_LABELS } from "@/lib/booking/labels";
import { formatInZone, formatTime } from "@/lib/booking/time";
import StatusBadge from "@/components/admin/booking/StatusBadge";
import BookingRowActions from "@/components/admin/booking/BookingRowActions";

const PAGE_SIZE = 25;
const STATUSES = Object.keys(STATUS_LABELS) as BookingStatus[];

export default async function BookingsListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; range?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const status = STATUSES.includes(sp.status as BookingStatus) ? (sp.status as BookingStatus) : undefined;
  const range = sp.range === "past" || sp.range === "all" ? sp.range : "upcoming";
  const page = Math.max(1, Number(sp.page) || 1);
  const { timezone: tz } = await getBookingSettings();
  const now = new Date();

  const where: Prisma.BookingWhereInput = {
    ...(status ? { status } : range !== "all" ? { status: { not: "RESCHEDULED" } } : {}),
    ...(range === "upcoming" ? { endTimeUTC: { gte: now } } : range === "past" ? { endTimeUTC: { lt: now } } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
            { reference: { contains: q.toUpperCase() } },
            { meetingType: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [count, bookings] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      include: { meetingType: true },
      orderBy: { startTimeUTC: range === "upcoming" ? "asc" : "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const link = (p: number) => `?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), range, page: String(p) })}`;

  return (
    <div className="space-y-6">
      <div className="bka-head">
        <div>
          <h1 className="font-display text-2xl font-bold">All bookings</h1>
          <p>
            {count} result{count === 1 ? "" : "s"} · times in {tz}
          </p>
        </div>
        <Link className="bka-button" href="/admin/booking/bookings/new">
          + Add booking
        </Link>
      </div>

      <form className="bka-filters" role="search">
        <label>
          Search
          <input name="q" defaultValue={q} placeholder="Name, email, company, reference" type="search" />
        </label>
        <label>
          Status
          <select name="status" defaultValue={status ?? ""}>
            <option value="">Any (excl. rescheduled)</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          When
          <select name="range" defaultValue={range}>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
            <option value="all">All</option>
          </select>
        </label>
        <button className="bka-button-ghost" type="submit">
          Apply
        </button>
      </form>

      <div className="card overflow-x-auto">
        <table className="bka-table w-full min-w-[1240px] text-sm">
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Name</th>
              <th>Email</th>
              <th>Meeting type</th>
              <th>Timezone</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted">
                  No bookings match these filters.
                </td>
              </tr>
            )}
            {bookings.map((b) => (
              <tr key={b.id}>
                <td className="whitespace-nowrap">{formatInZone(b.startTimeUTC, tz, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</td>
                <td className="whitespace-nowrap">
                  {formatTime(b.startTimeUTC, tz)} - {formatTime(b.endTimeUTC, tz)}
                </td>
                <td>
                  <Link href={`/admin/booking/bookings/${b.id}`} className="font-medium hover:underline">
                    {b.fullName}
                  </Link>
                  {b.company && <div className="bka-muted">{b.company}</div>}
                </td>
                <td>
                  <a href={`mailto:${b.email}`} className="hover:underline">
                    {b.email}
                  </a>
                </td>
                <td>{b.meetingType.name}</td>
                <td className="bka-muted">{b.visitorTimezone}</td>
                <td>
                  <StatusBadge status={b.status} />
                </td>
                <td className="bka-muted whitespace-nowrap">{formatInZone(b.createdAt, tz, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                <td>
                  <BookingRowActions id={b.id} status={b.status} upcoming={b.startTimeUTC > now} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pages > 1 && (
          <nav className="bka-pager" aria-label="Pagination">
            {page > 1 ? <Link href={link(page - 1)} className="text-accent">← Previous</Link> : <span />}
            <span className="bka-muted">
              Page {page} of {pages}
            </span>
            {page < pages ? <Link href={link(page + 1)} className="text-accent">Next →</Link> : <span />}
          </nav>
        )}
      </div>
    </div>
  );
}
