import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { deleteProject } from "@/actions/projects";
import { DeleteButton } from "@/components/admin/ui";

export default async function AdminProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: [{ featured: "desc" }, { order: "asc" }],
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold">Projects</h1>
        <Link
          href="/admin/projects/new"
          className="rounded-xl bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          + New Project
        </Link>
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
              <th className="px-5 py-3">Project</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">Featured</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className="border-b border-border/60 last:border-0">
                <td className="px-5 py-3">
                  <p className="font-medium">{p.title}</p>
                  <p className="text-xs text-faint">/{p.slug}</p>
                </td>
                <td className="px-5 py-3 text-muted">{p.category}</td>
                <td className="px-5 py-3">{p.featured ? "★" : "—"}</td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      p.status === "PUBLISHED"
                        ? "bg-emerald/15 text-emerald"
                        : "bg-surface-raised text-muted"
                    }`}
                  >
                    {p.status.toLowerCase()}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-4">
                    <Link
                      href={`/admin/projects/${p.id}/edit`}
                      className="text-sm text-accent hover:underline"
                    >
                      Edit
                    </Link>
                    <DeleteButton action={deleteProject.bind(null, p.id)} />
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
