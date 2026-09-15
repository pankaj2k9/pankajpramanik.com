import Link from "next/link";
import LoginForm from "@/components/admin/LoginForm";
import { adminReturnPath } from "@/lib/admin-return";
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  return (
    <main
      id="main-content"
      className="flex min-h-dvh items-center justify-center px-6 py-12"
    >
      <div className="w-full max-w-md">
        <p className="eyebrow text-center text-muted">
          Pankaj Pramanik / Workspace
        </p>
        <h1 className="mt-4 text-center text-3xl font-medium">Welcome back.</h1>
        <p className="mt-3 text-center text-sm text-muted">
          Sign in to manage your content and inquiries.
        </p>
        <LoginForm returnTo={adminReturnPath(callbackUrl)} />
        <Link href="/" className="text-link mt-4">
          ← Return to website
        </Link>
      </div>
    </main>
  );
}
