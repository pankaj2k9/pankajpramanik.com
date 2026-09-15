"use client";
import { useActionState } from "react";
import { login } from "@/actions/auth";
export default function LoginForm({ returnTo }: { returnTo: string }) {
  const [error, formAction, pending] = useActionState(login, undefined);
  return (
    <form
      action={formAction}
      onReset={(event) => event.preventDefault()}
      className="card mt-8 space-y-5 p-8"
    >
      <input type="hidden" name="returnTo" value={returnTo} />
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm"
        />
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-border bg-surface-raised p-4 text-sm"
        >
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="button-primary w-full justify-center"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
