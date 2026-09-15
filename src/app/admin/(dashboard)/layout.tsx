import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logout } from "@/actions/auth";
import AdminNav from "@/components/admin/AdminNav";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();
  const account = (
    <div className="border-t border-border p-4">
      <p className="truncate text-xs text-muted">{session.user?.email}</p>
      <div className="mt-3 flex gap-5">
        <Link href="/" className="text-xs underline">
          View site ↗
        </Link>
        <form action={logout}>
          <button className="text-xs underline">Sign out</button>
        </form>
      </div>
    </div>
  );
  return (
    <div className="admin-shell flex min-h-dvh">
      <a href="#main-content" className="skip-link">
        Skip to dashboard content
      </a>
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <Link
          href="/admin"
          className="border-b border-border p-6 text-lg font-semibold"
        >
          Pankaj.{" "}
          <span className="text-xs font-normal text-muted">/ workspace</span>
        </Link>
        <div className="flex-1">
          <AdminNav />
        </div>
        {account}
      </aside>
      <div className="admin-main">
        <header className="admin-mobile">
          <details key={session.user?.email}>
            <summary>Workspace navigation</summary>
            <AdminNav />
          </details>
          {account}
        </header>
        <main id="main-content" className="p-6 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
