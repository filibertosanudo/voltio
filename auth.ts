import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import type { UserRole } from "@/lib/generated/prisma/enums";
import { authenticate, currentStaff } from "@/lib/auth/authenticate";
import { clientIpFrom } from "@/lib/security/client-ip";
import { env } from "@/lib/env";

// How long a token is trusted before a request re-checks the account. A JWT
// cannot be revoked, so without this a deactivated employee would keep
// their session until it expired; with it, at most a minute.
const REVALIDATE_INTERVAL_MS = 60_000;

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      /** Set once a revalidation finds the account gone or deactivated. Every guard treats it as signed out. */
      revoked: boolean;
    };
  }
  interface User {
    role?: UserRole;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role: UserRole;
    revoked?: boolean;
    checkedAt: number;
  }
}

const credentialsSchema = z.object({ email: z.email().max(200), password: z.string().min(1).max(200) });

export const { handlers, auth, signIn, signOut } = NextAuth({
  // A working day, not a month.
  session: { strategy: "jwt", maxAge: 60 * 60 * 10 },
  pages: { signIn: "/admin/login" },
  // Self-hosted behind its own proxy: the host header is ours to trust.
  trustHost: true,
  providers: [
    Credentials({
      credentials: { email: { type: "email" }, password: { type: "password" } },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const ip = clientIpFrom(request.headers, env.TRUSTED_PROXY_COUNT);
        return authenticate(parsed.data.email, parsed.data.password, ip);
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role ?? "TECHNICIAN";
        token.revoked = false;
        token.checkedAt = Date.now();
        return token;
      }
      if (token.revoked) return token;
      if (Date.now() - (token.checkedAt ?? 0) <= REVALIDATE_INTERVAL_MS) return token;

      const staff = token.sub ? await currentStaff(token.sub) : null;
      if (!staff) {
        token.revoked = true;
        return token;
      }
      token.role = staff.role;
      token.name = staff.name;
      token.checkedAt = Date.now();
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub as string;
      session.user.role = token.role;
      session.user.revoked = token.revoked ?? false;
      return session;
    },
  },
});
