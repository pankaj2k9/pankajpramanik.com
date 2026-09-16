import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { absoluteUrl } from "@/lib/site";
import { connectGoogle } from "@/lib/booking/google";

export async function GET(req: NextRequest) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN")
    return NextResponse.redirect(absoluteUrl("/admin/login"));

  const done = (result: string) => {
    const res = NextResponse.redirect(absoluteUrl(`/admin/booking/settings?google=${result}`));
    res.cookies.delete({ name: "booking_google_state", path: "/api/admin/booking/google" });
    return res;
  };

  const state = req.nextUrl.searchParams.get("state") ?? "";
  const expected = req.cookies.get("booking_google_state")?.value ?? "";
  if (!state || state.length !== expected.length || !timingSafeEqual(Buffer.from(state), Buffer.from(expected)))
    return done("invalid-state");
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return done("denied");
  try {
    await connectGoogle(code);
    return done("connected");
  } catch (error) {
    console.error("Google connect failed:", error instanceof Error ? error.message : error);
    return done("error");
  }
}
