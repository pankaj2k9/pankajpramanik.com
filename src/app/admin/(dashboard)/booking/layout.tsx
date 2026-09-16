import "@/styles/admin-booking.css";
import { requireAdmin } from "@/lib/auth";
import { BookingSubNav } from "@/components/admin/booking/ui";

export default async function BookingAdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div>
      <BookingSubNav />
      {children}
    </div>
  );
}
