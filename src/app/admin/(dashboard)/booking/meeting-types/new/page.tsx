import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import MeetingTypeForm from "@/components/admin/booking/MeetingTypeForm";

export default async function NewMeetingTypePage() {
  await requireAdmin();
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="bka-muted">
          <Link href="/admin/booking/meeting-types" className="hover:underline">← Meeting types</Link>
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold">New meeting type</h1>
      </div>
      <div className="card p-6">
        <MeetingTypeForm />
      </div>
    </div>
  );
}
