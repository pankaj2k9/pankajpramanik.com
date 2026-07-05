import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminPagesPage() {
  const pages = await prisma.page.findMany({
    orderBy: [{ kind: "asc" }, { label: "asc" }, { slug: "asc" }],
  });
  const services = pages.filter((p) => p.kind === "SERVICE");
  const generic = pages.filter((p) => p.kind === "GENERIC");

  const Row = ({ p }: { p: (typeof pages)[number] }) => (
    <tr className="border-b border-border/60 last:border-0">
      <td className="px-5 py-3">
        <p className="font-medium">{p.label || p.title}</p>
        <p className="text-xs text-faint">
          {p.kind === "SERVICE" ? `/services/${p.slug}` : `/${p.slug}`}
        </p>
      </td>
      <td className="px-5 py-3">
        {p.seoTitle ? (
          <span className="text-emerald">✓</span>
        ) : (
          <span className="text-faint">—</span>
        )}
      </td>
      <td className="px-5 py-3 text-right">
        <div className="flex items-center justify-end gap-4">
          <Link
            href={p.kind === "SERVICE" ? `/services/${p.slug}` : `/${p.slug}`}
            target="_blank"
            className="text-sm text-muted hover:text-accent"
          >
            View
          </Link>
          <Link
            href={`/admin/pages/${p.id}/edit`}
            className="text-sm text-accent hover:underline"
          >
            Edit
          </Link>
        </div>
      </td>
    </tr>
  );

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Pages &amp; services</h1>
      <p className="mt-1 text-sm text-muted">
        Edit content, card labels, and SEO metadata for service pages and
        static pages.
      </p>

      <h2 className="mt-8 font-display text-lg font-semibold">
        Service pages ({services.length})
      </h2>
      <div className="card mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
              <th className="px-5 py-3">Page</th>
              <th className="px-5 py-3">SEO</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.map((p) => (
              <Row key={p.id} p={p} />
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 font-display text-lg font-semibold">
        Static pages ({generic.length})
      </h2>
      <div className="card mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
              <th className="px-5 py-3">Page</th>
              <th className="px-5 py-3">SEO</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {generic.map((p) => (
              <Row key={p.id} p={p} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
