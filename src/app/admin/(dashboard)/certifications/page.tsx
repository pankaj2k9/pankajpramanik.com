import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { deleteCertification } from "@/actions/certifications";
import { DeleteButton } from "@/components/admin/ui";

export default async function AdminCertificationsPage() {
  const certs = await prisma.certification.findMany({
    orderBy: { order: "asc" },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold">Certifications</h1>
        <Link
          href="/admin/certifications/new"
          className="rounded-xl bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          + New Certification
        </Link>
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
              <th className="px-5 py-3">Certification</th>
              <th className="px-5 py-3">Issuer</th>
              <th className="px-5 py-3">Link</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {certs.map((c) => (
              <tr key={c.id} className="border-b border-border/60 last:border-0">
                <td className="px-5 py-3 font-medium">{c.title}</td>
                <td className="px-5 py-3 text-muted">{c.issuer}</td>
                <td className="px-5 py-3">
                  {c.url ? (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      View ↗
                    </a>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-4">
                    <Link
                      href={`/admin/certifications/${c.id}/edit`}
                      className="text-sm text-accent hover:underline"
                    >
                      Edit
                    </Link>
                    <DeleteButton action={deleteCertification.bind(null, c.id)} />
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
