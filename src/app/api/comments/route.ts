import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp, hashIp } from "@/lib/client-ip";

const commentSchema = z.object({
  postId: z.string().trim().min(1).max(40),
  name: z.string().trim().min(2, "Name is too short").max(80),
  email: z.string().trim().email("Invalid email address").max(200),
  body: z
    .string()
    .trim()
    .min(3, "Comment is too short")
    .max(3000, "Comment is too long (3000 characters max)"),
  // Honeypot — hidden from humans; bots fill it in.
  website: z.string().max(500).optional(),
  startedAt: z.coerce.number().optional(),
});

// Control characters other than tab/newline have no place in a comment.
const CONTROL = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F\\u202A-\\u202E\\u2066-\\u2069]", "g");

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  const limited = await rateLimit(`comment:${ip}`, { limit: 4, windowMs: 600_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many comments. Please try again later." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const { postId, email, startedAt } = parsed.data;
  const name = parsed.data.name.replace(CONTROL, "");
  const text = parsed.data.body.replace(CONTROL, "");

  // Honeypot filled or submitted faster than a human types: pretend success.
  if (parsed.data.website || (startedAt && Date.now() - startedAt < 4000)) {
    return NextResponse.json({ ok: true, pending: true });
  }

  const post = await prisma.post.findFirst({
    where: { id: postId, status: "PUBLISHED" },
    select: { title: true, slug: true },
  });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  // Link-stuffed comments go straight to the spam queue instead of pending.
  const links = text.match(/https?:\/\/|www\./gi)?.length ?? 0;
  const status = links > 2 ? "SPAM" : "PENDING";

  await prisma.comment.create({
    data: { postId, name, email, body: text, status, ipHash: hashIp(ip) },
  });

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_EMAIL;
  if (apiKey && to && status === "PENDING") {
    try {
      await new Resend(apiKey).emails.send({
        from: process.env.CONTACT_FROM_EMAIL ?? "Portfolio <onboarding@resend.dev>",
        to,
        subject: `[pankajpramanik.com] New comment awaiting approval - ${post.title}`,
        text: `${name} <${email}> commented on /blog/${post.slug}:\n\n${text}\n\nModerate: /admin/comments`,
      });
    } catch (err) {
      console.error("Comment notification failed:", err);
    }
  }

  return NextResponse.json({ ok: true, pending: true });
}
