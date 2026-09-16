import type { BookingStatus } from "@prisma/client";
import { STATUS_LABELS } from "@/lib/booking/labels";

export default function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`bka-status is-${status.toLowerCase()}`}>{STATUS_LABELS[status]}</span>;
}
