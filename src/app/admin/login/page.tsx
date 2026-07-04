"use client";

import { useActionState } from "react";
import { login } from "@/actions/auth";

export default function AdminLoginPage() {
  const [error, formAction, pending] = useActionState(login, undefined);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="text-center font-display text-2xl font-bold">
          Pankaj<span className="text-gradient">.</span>{" "}
          <span className="text-muted">admin</span>
        </p>

        <form
          action={formAction}
          className="card mt-8 space-y-5 p-8"
        >
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm outline-none transition focus:border-accent"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm outline-none transition focus:border-accent"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-pink/40 bg-pink/10 px-4 py-3 text-sm text-pink"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-accent-strong px-6 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
