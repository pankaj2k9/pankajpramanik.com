import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { looksLikeToken } from "@/lib/booking/crypto";
import { bookingIcs } from "@/lib/booking/ics";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const booking = looksLikeToken(token)
    ? await prisma.booking.findUnique({ where: { bookingToken: token }, include: { meetingType: true } })
    : null;
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  return new NextResponse(bookingIcs(booking, booking.status === "CANCELLED" ? "CANCEL" : "PUBLISH"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${booking.reference}.ics"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
