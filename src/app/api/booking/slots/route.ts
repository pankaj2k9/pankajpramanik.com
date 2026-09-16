import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";
import { getBookingSettings, getPublicSlots } from "@/lib/booking/service";
import { looksLikeToken } from "@/lib/booking/crypto";

const MAX_RANGE = 45 * 86_400_000;

/** GET /api/booking/slots?type=slug&start=ISO&end=ISO[&reschedule=token] -> UTC slot starts. */
export async function GET(req: NextRequest) {
  const limited = await rateLimit(`booking-slots:${clientIp(req.headers)}`, { limit: 120, windowMs: 60_000 });
  if (!limited.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const params = req.nextUrl.searchParams;
  const start = new Date(params.get("start") ?? "");
  const end = new Date(params.get("end") ?? "");
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start || end.getTime() - start.getTime() > MAX_RANGE)
    return NextResponse.json({ error: "Invalid date range." }, { status: 400 });

  const settings = await getBookingSettings();
  if (!settings.bookingEnabled) return NextResponse.json({ slots: [] }, { headers: { "Cache-Control": "no-store" } });

  const meetingType = await prisma.meetingType.findFirst({ where: { slug: params.get("type") ?? "", active: true } });
  if (!meetingType) return NextResponse.json({ error: "Meeting type not found." }, { status: 404 });

  // When rescheduling, the booking's own current slot does not block itself.
  const token = params.get("reschedule");
  const own = token && looksLikeToken(token)
    ? await prisma.booking.findUnique({ where: { bookingToken: token }, select: { id: true, meetingTypeId: true } })
    : null;

  const slots = await getPublicSlots(meetingType, start, end, own?.meetingTypeId === meetingType.id ? own.id : undefined);
  return NextResponse.json(
    { slots: slots.map((s) => s.toISOString()), timezone: settings.timezone },
    { headers: { "Cache-Control": "no-store" } },
  );
}
