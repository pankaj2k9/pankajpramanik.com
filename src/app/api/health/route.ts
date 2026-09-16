import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Liveness + readiness for the container healthcheck and the deploy workflow.
// Answers 200 only when the app can reach PostgreSQL. Never cached, and never
// includes error details — it is reachable through the public proxy.
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { headers: noStore });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers: noStore });
  }
}
