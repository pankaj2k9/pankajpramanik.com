import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { deleteMeetingType, toggleMeetingType } from "@/actions/booking";
import { durationLabel, LOCATION_LABELS } from "@/lib/booking/labels";
import { ActionButton } from "@/components/admin/booking/ui";

export default async function MeetingTypesPage() {
  await requireAdmin();
  const types = await prisma.meetingType.findMany({
    orderBy: [{ order: "asc" }, { durationMinutes: "asc" }],
    include: { _count: { select: { bookings: true } } },
  });
  return (
    <div className="space-y-6">
      <div className="bka-head">
        <div>
          <h1 className="font-display text-2xl font-bold">Meeting types</h1>
          <p>What visitors can book. Inactive types are hidden from /booking.</p>
        </div>
        <Link className="bka-button" href="/admin/booking/meeting-types/new">
          + New meeting type
        </Link>
      </div>
      <div className="card overflow-x-auto">
        <table className="bka-table w-full min-w-[820px] text-sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>Duration</th>
              <th>Buffers</th>
              <th>Method</th>
              <th>Bookings</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {types.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted">
                  No meeting types yet. Create one so visitors can book.
                </td>
              </tr>
            )}
            {types.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link className="font-medium hover:underline" href={`/admin/booking/meeting-types/${t.id}`}>
                    {t.name}
                  </Link>
                  <div className="bka-muted">/booking?type={t.slug}</div>
                </td>
                <td>{durationLabel(t.durationMinutes)}</td>
                <td className="bka-muted">
                  {t.bufferBeforeMinutes} / {t.bufferAfterMinutes} min
                </td>
                <td>{LOCATION_LABELS[t.locationType]}</td>
                <td>{t._count.bookings}</td>
                <td>
                  <span className={`bka-status ${t.active ? "" : "is-cancelled"}`}>{t.active ? "Active" : "Inactive"}</span>
                </td>
                <td>
                  <div className="bka-actions">
                    <Link className="text-sm text-accent hover:underline" href={`/admin/booking/meeting-types/${t.id}`}>
                      Edit
                    </Link>
                    <ActionButton label={t.active ? "Deactivate" : "Activate"} action={toggleMeetingType.bind(null, t.id, !t.active)} />
                    <ActionButton
                      label="Delete"
                      tone="danger"
                      confirmText={
                        t._count.bookings
                          ? "This type has bookings, so it will be deactivated instead of deleted. Continue?"
                          : "Delete this meeting type?"
                      }
                      action={deleteMeetingType.bind(null, t.id)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
