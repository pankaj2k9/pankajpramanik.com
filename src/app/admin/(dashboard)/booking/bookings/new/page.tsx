import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getBookingSettings } from "@/lib/booking/service";
import { durationLabel } from "@/lib/booking/labels";
import { DATE_KEY_RE, WALL_TIME_RE, dateKeyInZone } from "@/lib/booking/time";
import { createManualBooking } from "@/actions/booking";
import { ActionForm } from "@/components/admin/booking/ui";
import { inputCls, labelCls } from "@/components/admin/ui";

export default async function NewBookingPage({ searchParams }: { searchParams: Promise<{ date?: string; time?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [settings, types] = await Promise.all([
    getBookingSettings(),
    prisma.meetingType.findMany({ orderBy: [{ active: "desc" }, { order: "asc" }] }),
  ]);
  const date = sp.date && DATE_KEY_RE.test(sp.date) ? sp.date : dateKeyInZone(new Date(), settings.timezone);
  const time = sp.time && WALL_TIME_RE.test(sp.time) ? sp.time : "10:00";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="bka-muted">
          <Link href="/admin/booking/bookings" className="hover:underline">← All bookings</Link>
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold">Add booking</h1>
        <p className="bka-muted mt-1">
          Uses the same conflict checks as the public page. Date and time are in {settings.timezone}.
        </p>
      </div>
      <div className="card p-6">
        <ActionForm action={createManualBooking} submitLabel="Create booking">
          <div>
            <label className={labelCls} htmlFor="meetingTypeId">Meeting type *</label>
            <select id="meetingTypeId" name="meetingTypeId" required className={inputCls}>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({durationLabel(t.durationMinutes)}){t.active ? "" : " - inactive"}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <label className={labelCls} htmlFor="date">Date *</label>
              <input id="date" name="date" type="date" required defaultValue={date} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="time">Start time *</label>
              <input id="time" name="time" type="time" required step={300} defaultValue={time} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="status">Status</label>
              <select id="status" name="status" className={inputCls} defaultValue="CONFIRMED">
                <option value="CONFIRMED">Confirmed</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="fullName">Full name *</label>
              <input id="fullName" name="fullName" required className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="email">Email *</label>
              <input id="email" name="email" type="email" required className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="company">Company</label>
              <input id="company" name="company" className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="phone">Phone</label>
              <input id="phone" name="phone" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="purpose">Purpose *</label>
            <input id="purpose" name="purpose" required className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="notes">Notes</label>
            <textarea id="notes" name="notes" rows={3} className={inputCls} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="visitorTimezone">Attendee timezone</label>
              <input id="visitorTimezone" name="visitorTimezone" defaultValue={settings.timezone} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="meetingUrl">Meeting link (optional)</label>
              <input id="meetingUrl" name="meetingUrl" type="url" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="adminNotes">Private admin notes</label>
            <textarea id="adminNotes" name="adminNotes" rows={2} className={inputCls} />
          </div>
          <label className="bka-check">
            <input type="checkbox" name="override" defaultChecked /> Allow outside working hours / notice window (overlaps are still blocked)
          </label>
          <label className="bka-check">
            <input type="checkbox" name="notify" defaultChecked /> Send confirmation email to the attendee
          </label>
        </ActionForm>
      </div>
    </div>
  );
}
