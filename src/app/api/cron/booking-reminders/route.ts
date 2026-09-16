import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { processDueNotifications } from "@/lib/booking/notifications";

/**
 * Sends due booking reminders and retries failed booking emails.
 * Call every 5 minutes with `Authorization: Bearer $CRON_SECRET`, e.g.
 *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://pankajpramanik.com/api/cron/booking-reminders
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const ok =
    Boolean(secret) &&
    given.length === secret!.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(secret!));
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const processed = await processDueNotifications();
  return NextResponse.json({ processed });
}
