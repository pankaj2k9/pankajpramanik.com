import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export default async function AdminDashboard() {
  await requireAdmin();
  const [posts, drafts, projects, experiences, messages, unread, recent] =
    await Promise.all([
      prisma.post.count(),
      prisma.post.count({ where: { status: "DRAFT" } }),
      prisma.project.count(),
      prisma.experience.count(),
      prisma.contactMessage.count(),
      prisma.contactMessage.count({ where: { read: false } }),
      prisma.contactMessage.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  const stats = [
    {
      label: "Blog posts",
      value: posts,
      hint: `${drafts} draft${drafts === 1 ? "" : "s"}`,
      href: "/admin/posts",
    },
    {
      label: "Projects",
      value: projects,
      hint: "portfolio items",
      href: "/admin/projects",
    },
    {
      label: "Experiences",
      value: experiences,
      hint: "timeline entries",
      href: "/admin/experience",
    },
    {
      label: "Messages",
      value: messages,
      hint: `${unread} unread`,
      href: "/admin/messages",
    },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Dashboard</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card card-hover p-5">
            <p className="text-sm text-muted">{s.label}</p>
            <p className="mt-1 font-display text-3xl font-bold">{s.value}</p>
            <p className="mt-1 text-xs text-faint">{s.hint}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/admin/posts/new"
          className="rounded-xl bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          + New Post
        </Link>
        <Link
          href="/admin/projects/new"
          className="rounded-xl border border-border-strong px-5 py-2.5 text-sm font-semibold transition hover:border-accent hover:text-accent"
        >
          + New Project
        </Link>
        <Link
          href="/admin/experience/new"
          className="rounded-xl border border-border-strong px-5 py-2.5 text-sm font-semibold transition hover:border-accent hover:text-accent"
        >
          + New Experience
        </Link>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold">Recent messages</h2>
        {recent.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No messages yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {recent.map((m) => (
              <li key={m.id} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {m.name}{" "}
                    <span className="font-normal text-faint">
                      &lt;{m.email}&gt;
                    </span>
                    {!m.read && (
                      <span className="ml-2 rounded-full bg-accent-strong/20 px-2 py-0.5 text-[11px] text-accent">
                        new
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-faint">
                    {formatDate(m.createdAt)}
                  </p>
                </div>
                {m.subject && (
                  <p className="mt-1 text-sm text-foreground">{m.subject}</p>
                )}
                <p className="mt-1 line-clamp-2 text-sm text-muted">
                  {m.message}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
