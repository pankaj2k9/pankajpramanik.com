import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { absoluteUrl } from "@/lib/site";
import { googleAuthUrl, isGoogleConfigured } from "@/lib/booking/google";

export async function GET() {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN")
    return NextResponse.redirect(absoluteUrl("/admin/login"));
  if (!isGoogleConfigured())
    return NextResponse.redirect(absoluteUrl("/admin/booking/settings?google=not-configured"));
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(googleAuthUrl(state));
  res.cookies.set("booking_google_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/admin/booking/google",
    maxAge: 600,
  });
  return res;
}
