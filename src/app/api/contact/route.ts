import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(100),
  email: z.string().trim().email("Invalid email address").max(200),
  subject: z.string().trim().max(150).optional().default(""),
  message: z.string().trim().min(10, "Message is too short").max(5000),
  // Honeypot — humans never see this field; bots fill it in.
  website: z.string().max(0, "Spam detected").optional().or(z.literal("")),
  // Simple time-trap: form must be open at least 3 seconds before submit.
  startedAt: z.coerce.number().optional(),
});

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // 5 submissions per 10 minutes per IP
  const limited = rateLimit(`contact:${ip}`, { limit: 5, windowMs: 600_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name, email, subject, message, startedAt } = parsed.data;

  // Time-trap: silently accept (but drop) submissions faster than 3s.
  if (startedAt && Date.now() - startedAt < 3000) {
    return NextResponse.json({ ok: true });
  }

  // Store the message regardless of email delivery, so nothing is lost.
  await prisma.contactMessage.create({
    data: { name, email, subject, message },
  });

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_EMAIL;
  const from =
    process.env.CONTACT_FROM_EMAIL ?? "Portfolio Contact <onboarding@resend.dev>";

  if (apiKey && to) {
    try {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from,
        to,
        replyTo: email,
        subject: `[pankajpramanik.com] ${subject || "New contact message"} — ${name}`,
        text: `From: ${name} <${email}>\n\n${message}`,
      });
    } catch (err) {
      // message is already stored in the DB; log and still succeed
      console.error("Resend send failed:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
