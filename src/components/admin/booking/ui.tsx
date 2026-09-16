"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import type { BookingFormState } from "@/actions/booking";
import { FormError, SubmitButton } from "../ui";

export const BOOKING_NAV = [
  { href: "/admin/booking", label: "Dashboard" },
  { href: "/admin/booking/bookings", label: "Bookings" },
  { href: "/admin/booking/calendar", label: "Calendar" },
  { href: "/admin/booking/availability", label: "Availability" },
  { href: "/admin/booking/meeting-types", label: "Meeting types" },
  { href: "/admin/booking/blocked", label: "Blocked dates" },
  { href: "/admin/booking/settings", label: "Settings" },
];

export function BookingSubNav() {
  const pathname = usePathname();
  return (
    <nav className="bka-subnav" aria-label="Booking sections">
      {BOOKING_NAV.map((l) => {
        const current = l.href === "/admin/booking" ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={current ? "page" : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** A form bound to a server action, with inline error/success feedback. */
export function ActionForm({
  action,
  submitLabel,
  className = "space-y-5",
  children,
}: {
  action: (state: BookingFormState, formData: FormData) => Promise<BookingFormState>;
  submitLabel: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} onReset={(e) => e.preventDefault()} className={className}>
      {children}
      <FormError error={state?.error} />
      {state?.ok && (
        <p role="status" className="rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm">
          {state.ok}
        </p>
      )}
      <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
    </form>
  );
}

/** Small confirm-then-run button for row and calendar actions. */
export function ActionButton({
  action,
  label,
  confirmText,
  tone = "default",
}: {
  action: () => Promise<void>;
  label: string;
  confirmText?: string;
  tone?: "default" | "danger";
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return;
          start(async () => {
            setError("");
            try {
              await action();
            } catch (err) {
              setError(err instanceof Error && err.message.length < 140 ? err.message : "Action failed. Refresh and try again.");
            }
          });
        }}
        className={`text-sm transition-opacity hover:opacity-80 disabled:opacity-40 ${tone === "danger" ? "text-pink" : "text-accent"}`}
      >
        {pending ? "…" : label}
      </button>
      {error && (
        <span role="alert" className="text-xs text-muted">
          {error}
        </span>
      )}
    </span>
  );
}
