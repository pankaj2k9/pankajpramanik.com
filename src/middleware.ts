import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Edge middleware uses the Prisma-free config; the `authorized` callback
// in auth.config.ts gates everything under /admin except /admin/login.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/admin/:path*"],
};
