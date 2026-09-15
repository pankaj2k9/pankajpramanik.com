import { cache } from "react";
import { redirect } from "next/navigation";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";

// Compared against when the email is unknown, so a miss costs the same bcrypt
// time as a wrong password and response timing does not reveal valid emails.
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO5Ld3KZrWcG4Vn6h2dI8sDBxLr0yqk4a";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Admin login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        // Brute-force protection: per IP, and per account so rotating IPs
        // cannot hammer one admin. A limited attempt fails like a bad password.
        const ip = clientIp(request.headers);
        const [byIp, byAccount] = await Promise.all([
          rateLimit(`login:ip:${ip}`, { limit: 10, windowMs: 15 * 60_000 }),
          rateLimit(`login:acct:${email.toLowerCase()}`, { limit: 20, windowMs: 60 * 60_000 }),
        ]);
        if (!byIp.ok || !byAccount.ok) {
          console.warn(`Login rate limit hit (ip ${byIp.ok ? "ok" : "blocked"}, account ${byAccount.ok ? "ok" : "blocked"})`);
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
});

/** Throws if there is no authenticated admin — use at the top of server actions. */
export const requireAdmin = cache(async () => {
  const session = await auth();
  if (
    !session?.user?.id ||
    (session.user as { role?: string }).role !== "ADMIN"
  )
    redirect("/admin/login");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") redirect("/admin/login");
  return session;
});
