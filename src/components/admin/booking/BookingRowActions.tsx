"use client";

import Link from "next/link";
import type { BookingStatus } from "@prisma/client";
import { changeBookingStatus, quickCancelBooking, removeBooking } from "@/actions/booking";
import { ActionButton } from "./ui";

export default function BookingRowActions({
  id,
  status,
  upcoming,
  compact = false,
}: {
  id: string;
  status: BookingStatus;
  upcoming: boolean;
  compact?: boolean;
}) {
  const active = status === "CONFIRMED" || status === "PENDING";
  return (
    <div className="bka-actions">
      {!compact && (
        <>
          <Link className="text-sm text-accent hover:underline" href={`/admin/booking/bookings/${id}`}>
            View
          </Link>
          <Link className="text-sm text-accent hover:underline" href={`/admin/booking/bookings/${id}#edit`}>
            Edit
          </Link>
        </>
      )}
      {active && upcoming && (
        <Link className="text-sm text-accent hover:underline" href={`/admin/booking/bookings/${id}#reschedule`}>
          Reschedule
        </Link>
      )}
      {status === "PENDING" && <ActionButton label="Approve" action={() => changeBookingStatus(id, "CONFIRMED")} />}
      {active && <ActionButton label="Mark completed" action={() => changeBookingStatus(id, "COMPLETED")} />}
      {active && !upcoming && <ActionButton label="No show" action={() => changeBookingStatus(id, "NO_SHOW")} />}
      {active && (
        <ActionButton
          label="Cancel"
          tone="danger"
          confirmText="Cancel this booking? The attendee is emailed and the calendar event is removed."
          action={() => quickCancelBooking(id)}
        />
      )}
      <ActionButton
        label="Delete"
        tone="danger"
        confirmText="Delete this booking permanently? No email is sent. Prefer Cancel for real cancellations."
        action={() => removeBooking(id)}
      />
    </div>
  );
}
