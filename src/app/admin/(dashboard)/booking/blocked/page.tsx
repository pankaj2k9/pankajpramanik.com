import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { createBlockedTime, deleteBlockedTime } from "@/actions/booking";
import { getBookingSettings } from "@/lib/booking/service";
import { DATE_KEY_RE, dateKeyInZone, formatInZone } from "@/lib/booking/time";
import { ActionButton, ActionForm } from "@/components/admin/booking/ui";
import { inputCls, labelCls } from "@/components/admin/ui";

export default async function BlockedPage({ searchParams }: { searchParams: Promise<{ date?: string; past?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const settings = await getBookingSettings();
  const tz = settings.timezone;
  const date = sp.date && DATE_KEY_RE.test(sp.date) ? sp.date : dateKeyInZone(new Date(), tz);
  const showPast = sp.past === "1";
  const blocks = await prisma.blockedTime.findMany({
    where: showPast ? {} : { endTimeUTC: { gte: new Date() } },
    orderBy: { startTimeUTC: showPast ? "desc" : "asc" },
    take: 200,
  });
  const fmt = (d: Date) => formatInZone(d, tz, { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <div className="max-w-5xl space-y-6">
      <div className="bka-head">
        <div>
          <h1 className="font-display text-2xl font-bold">Blocked dates</h1>
          <p>Block single days, time ranges or vacations. Times in {tz}. Existing bookings are not changed.</p>
        </div>
      </div>

      <section className="card p-6" aria-labelledby="new-block">
        <h2 id="new-block" className="bka-section-title mb-4">
          Block time
        </h2>
        <ActionForm action={createBlockedTime} submitLabel="Add block">
          <div className="grid gap-5 sm:grid-cols-4">
            <div>
              <label className={labelCls} htmlFor="startDate">From date *</label>
              <input id="startDate" name="startDate" type="date" required defaultValue={date} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="startTime">From time</label>
              <input id="startTime" name="startTime" type="time" step={300} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="endDate">To date *</label>
              <input id="endDate" name="endDate" type="date" required defaultValue={date} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="endTime">To time</label>
              <input id="endTime" name="endTime" type="time" step={300} className={inputCls} />
            </div>
          </div>
          <p className="bka-muted">Leave both times empty (or tick “whole days”) to block complete days, including the end date.</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="kind">Type</label>
              <select id="kind" name="kind" className={inputCls} defaultValue="BLOCKED">
                <option value="BLOCKED">Unavailable / blocked</option>
                <option value="VACATION">Vacation</option>
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="reason">Private note</label>
              <input id="reason" name="reason" maxLength={200} className={inputCls} />
            </div>
          </div>
          <label className="bka-check">
            <input type="checkbox" name="allDay" /> Whole days
          </label>
        </ActionForm>
      </section>

      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between gap-4 px-4 pt-4">
          <h2 className="bka-section-title">{showPast ? "All blocks" : "Current and upcoming blocks"}</h2>
          <a className="text-sm text-accent hover:underline" href={showPast ? "?" : "?past=1"}>
            {showPast ? "Hide past" : "Show past"}
          </a>
        </div>
        <table className="bka-table mt-2 w-full min-w-[700px] text-sm">
          <thead>
            <tr>
              <th>From</th>
              <th>Until</th>
              <th>Type</th>
              <th>Note</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {blocks.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted">
                  Nothing blocked.
                </td>
              </tr>
            )}
            {blocks.map((b) => (
              <tr key={b.id}>
                <td className="whitespace-nowrap">{fmt(b.startTimeUTC)}</td>
                <td className="whitespace-nowrap">{fmt(b.endTimeUTC)}</td>
                <td>{b.kind === "VACATION" ? "Vacation" : "Blocked"}</td>
                <td className="bka-muted">{b.reason || "-"}</td>
                <td>
                  <ActionButton label="Remove" tone="danger" confirmText="Remove this block?" action={deleteBlockedTime.bind(null, b.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
