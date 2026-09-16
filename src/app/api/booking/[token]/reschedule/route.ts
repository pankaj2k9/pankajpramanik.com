import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";
import { looksLikeToken } from "@/lib/booking/crypto";
import { rescheduleSchema } from "@/lib/booking/validation";
import { BookingError, rescheduleBooking, SlotTakenError } from "@/lib/booking/service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const limited = await rateLimit(`booking-manage:${clientIp(req.headers)}`, { limit: 20, windowMs: 60 * 60_000 });
  if (!limited.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const { token } = await params;
  const booking = looksLikeToken(token) ? await prisma.booking.findUnique({ where: { bookingToken: token } }) : null;
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  const parsed = rescheduleSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  if (booking.startTimeUTC.getTime() < Date.now())
    return NextResponse.json({ error: "This meeting has already started." }, { status: 400 });
  try {
    const moved = await rescheduleBooking(booking.id, new Date(parsed.data.start), {
      visitorTimezone: parsed.data.visitorTimezone,
    });
    return NextResponse.json({ token: moved.bookingToken });
  } catch (error) {
    if (error instanceof SlotTakenError) return NextResponse.json({ error: error.message, code: "SLOT_TAKEN" }, { status: 409 });
    if (error instanceof BookingError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Reschedule failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "The booking could not be rescheduled. Please try again." }, { status: 500 });
  }
}
