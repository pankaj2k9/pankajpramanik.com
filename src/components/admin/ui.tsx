"use client";

import { useTransition } from "react";

export const inputCls =
  "w-full rounded-xl border border-border bg-surface-raised px-4 py-2.5 text-sm outline-none transition focus:border-accent";
export const labelCls = "mb-1.5 block text-sm font-medium";

export function DeleteButton({
  action,
  label = "Delete",
  confirmText = "Delete this item? This cannot be undone.",
}: {
  action: () => Promise<void>;
  label?: string;
  confirmText?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm(confirmText)) startTransition(() => action());
      }}
      className="text-sm text-pink transition-opacity hover:opacity-80 disabled:opacity-40"
    >
      {pending ? "…" : label}
    </button>
  );
}

export function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-accent-strong px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Saving…" : children}
    </button>
  );
}

export function FormError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-pink/40 bg-pink/10 px-4 py-3 text-sm text-pink"
    >
      {error}
    </p>
  );
}
