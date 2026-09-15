import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMonthYear } from "@/lib/utils";
import { deleteExperience } from "@/actions/experiences";
import { DeleteButton } from "@/components/admin/ui";

export default async function AdminExperiencePage() {
  await requireAdmin();
  const experiences = await prisma.experience.findMany({
    orderBy: { order: "asc" },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold">Work experience</h1>
        <Link
          href="/admin/experience/new"
          className="rounded-xl bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          + New Experience
        </Link>
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Period</th>
              <th className="px-5 py-3">Order</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {experiences.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted">
                  No experience yet. Use the create button to add your first
                  item.
                </td>
              </tr>
            )}
            {experiences.map((e) => (
              <tr
                key={e.id}
                className="border-b border-border/60 last:border-0"
              >
                <td className="px-5 py-3">
                  <p className="font-medium">{e.role}</p>
                  <p className="text-xs text-faint">{e.company}</p>
                </td>
                <td className="px-5 py-3 text-muted">
                  {formatMonthYear(e.startDate)} —{" "}
                  {e.current ? "Present" : formatMonthYear(e.endDate)}
                </td>
                <td className="px-5 py-3 text-muted">{e.order}</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-4">
                    <Link
                      href={`/admin/experience/${e.id}/edit`}
                      className="text-sm text-accent hover:underline"
                    >
                      Edit
                    </Link>
                    <DeleteButton action={deleteExperience.bind(null, e.id)} />
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
