"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="admin-navigation" aria-label="Dashboard navigation">
      {[
        { href: "/admin", label: "Overview" },
        { href: "/admin/posts", label: "Blog posts" },
        { href: "/admin/projects", label: "Projects" },
        { href: "/admin/pages", label: "Pages & services" },
        { href: "/admin/experience", label: "Experience" },
        { href: "/admin/certifications", label: "Certifications" },
        { href: "/admin/skills", label: "Skills" },
        { href: "/admin/messages", label: "Messages" },
      ].map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={
            (
              l.href === "/admin"
                ? pathname === l.href
                : pathname.startsWith(l.href)
            )
              ? "page"
              : undefined
          }
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
