import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Next.js 16 proxy (formerly middleware). Uses the Prisma-free auth config;
// the `authorized` callback in auth.config.ts gates everything under /admin
// except /admin/login.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: ["/admin/:path*"],
};
