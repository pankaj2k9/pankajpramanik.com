import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import MeetingTypeForm from "@/components/admin/booking/MeetingTypeForm";

export default async function EditMeetingTypePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const type = await prisma.meetingType.findUnique({ where: { id } });
  if (!type) notFound();
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="bka-muted">
          <Link href="/admin/booking/meeting-types" className="hover:underline">← Meeting types</Link>
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold">Edit {type.name}</h1>
        <p className="bka-muted mt-1">Changes apply to new bookings; existing bookings keep their time and buffers.</p>
      </div>
      <div className="card p-6">
        <MeetingTypeForm type={type} />
      </div>
    </div>
  );
}
