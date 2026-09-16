import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";
import { createBookingSchema } from "@/lib/booking/validation";
import { BookingError, createBooking, getBookingSettings, SlotTakenError } from "@/lib/booking/service";

/** POST /api/booking - creates a booking after server-side availability checks. */
export async function POST(req: NextRequest) {
  const limited = await rateLimit(`booking-create:${clientIp(req.headers)}`, { limit: 10, windowMs: 60 * 60_000 });
  if (!limited.ok)
    return NextResponse.json({ error: "Too many booking attempts. Please try again later." }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid booking details." }, { status: 400 });

  const { meetingType: slug, start, website, startedAt, ...details } = parsed.data;
  if (website || (startedAt && Date.now() - startedAt < 3000))
    return NextResponse.json({ error: "Please review your details and try again." }, { status: 400 });

  const settings = await getBookingSettings();
  if (!settings.bookingEnabled)
    return NextResponse.json({ error: "Online booking is paused right now. Please use the contact page." }, { status: 503 });

  const meetingType = await prisma.meetingType.findFirst({ where: { slug, active: true } });
  if (!meetingType) return NextResponse.json({ error: "This meeting type is no longer available." }, { status: 404 });
  if (meetingType.locationType === "PHONE" && !details.phone)
    return NextResponse.json({ error: "Enter a phone number for a phone call." }, { status: 400 });

  try {
    const booking = await createBooking(meetingType, new Date(start), details);
    return NextResponse.json({ token: booking.bookingToken, reference: booking.reference }, { status: 201 });
  } catch (error) {
    if (error instanceof SlotTakenError) return NextResponse.json({ error: error.message, code: "SLOT_TAKEN" }, { status: 409 });
    if (error instanceof BookingError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Booking failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "The booking could not be saved. Please try again." }, { status: 500 });
  }
}
