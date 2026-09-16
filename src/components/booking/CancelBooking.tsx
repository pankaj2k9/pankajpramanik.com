"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CancelBooking({ token, openInitially = false }: { token: string; openInitially?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(openInitially);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/booking/${token}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "The booking could not be cancelled.");
      router.replace(`/booking/${token}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The booking could not be cancelled.");
      setSending(false);
    }
  }

  if (!open)
    return (
      <button type="button" className="hm-link bk-danger" onClick={() => setOpen(true)}>
        Cancel booking
      </button>
    );

  return (
    <div className="bk-cancel" role="group" aria-labelledby="bk-cancel-title">
      <p id="bk-cancel-title" className="bk-cancel-title">
        Cancel this meeting?
      </p>
      <label className="ct-field">
        <textarea rows={3} maxLength={500} placeholder=" " value={reason} onChange={(e) => setReason(e.target.value)} />
        <span>Reason (optional)</span>
      </label>
      {error && (
        <p className="ct-error" role="alert">
          {error}
        </p>
      )}
      <div className="bk-cancel-actions">
        <button type="button" className="hm-button bk-danger-button" disabled={sending} onClick={cancel}>
          {sending ? "Cancelling…" : "Yes, cancel"}
        </button>
        <button type="button" className="hm-link" onClick={() => setOpen(false)}>
          Keep booking
        </button>
      </div>
    </div>
  );
}
