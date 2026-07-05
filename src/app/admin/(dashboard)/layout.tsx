import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { logout } from "@/actions/auth";

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

const nav = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/posts", label: "Blog Posts" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/experience", label: "Experience" },
  { href: "/admin/certifications", label: "Certifications" },
  { href: "/admin/skills", label: "Skills" },
  { href: "/admin/pages", label: "Pages & Services" },
  { href: "/admin/messages", label: "Messages" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // middleware already guards this, but defense in depth costs one call
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="border-b border-border p-5">
          <Link href="/admin" className="font-display text-lg font-bold">
            Pankaj<span className="text-gradient">.</span>{" "}
            <span className="text-sm font-normal text-muted">admin</span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="block rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border p-4">
          <p className="truncate text-xs text-faint">{session.user.email}</p>
          <div className="mt-3 flex items-center gap-3">
            <Link href="/" className="text-xs text-muted hover:text-accent">
              View site ↗
            </Link>
            <form action={logout}>
              <button className="text-xs text-muted hover:text-pink">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex-1">
        <header className="flex items-center gap-4 overflow-x-auto border-b border-border bg-surface px-5 py-3 md:hidden">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="whitespace-nowrap text-sm text-muted hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </header>
        <main className="p-6 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
