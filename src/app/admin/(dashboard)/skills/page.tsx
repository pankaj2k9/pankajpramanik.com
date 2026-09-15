import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { deleteSkillGroup } from "@/actions/skills";
import { DeleteButton } from "@/components/admin/ui";

export default async function AdminSkillsPage() {
  await requireAdmin();
  const groups = await prisma.skillGroup.findMany({
    orderBy: { order: "asc" },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold">Skill groups</h1>
        <Link
          href="/admin/skills/new"
          className="rounded-xl bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          + New Skill Group
        </Link>
      </div>

      <div className="mt-6 space-y-4">
        {groups.length === 0 && (
          <p className="card p-8 text-muted">
            No skill groups yet. Add a group to organize your technologies.
          </p>
        )}
        {groups.map((g) => (
          <div key={g.id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display font-semibold">
                {g.category}{" "}
                <span className="text-sm font-normal text-faint">
                  · order {g.order}
                </span>
              </h2>
              <div className="flex items-center gap-4">
                <Link
                  href={`/admin/skills/${g.id}/edit`}
                  className="text-sm text-accent hover:underline"
                >
                  Edit
                </Link>
                <DeleteButton action={deleteSkillGroup.bind(null, g.id)} />
              </div>
            </div>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {g.items.map((s) => (
                <li
                  key={s}
                  className="rounded-md border border-border bg-surface-raised px-2 py-0.5 text-[11px] text-muted"
                >
                  {s}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
