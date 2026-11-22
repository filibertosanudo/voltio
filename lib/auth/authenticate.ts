import "server-only";
import type { UserRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { dummyHash, verifyPassword } from "./password";

export type StaffIdentity = { id: string; email: string; name: string; role: UserRole };

/**
 * Checks a sign-in. Every attempt is counted before anything is looked up,
 * per email and per address, so guessing is slow whether it targets one
 * account from many places or many accounts from one. Every failure
 * returns the same null, after the same amount of work.
 */
export async function authenticate(email: string, password: string, ip: string | null): Promise<StaffIdentity | null> {
  const normalized = email.trim().toLowerCase();
  const allowedByEmail = await consumeRateLimit(RATE_LIMITS.signIn, `email:${normalized}`);
  const allowedByIp = ip ? await consumeRateLimit({ ...RATE_LIMITS.signIn, limit: 30 }, `ip:${ip}`) : true;

  const user = await prisma.user.findUnique({ where: { email: normalized } });
  const valid = await verifyPassword(user?.passwordHash ?? (await dummyHash()), password);

  if (!allowedByEmail || !allowedByIp || !user || !user.active || !valid) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/** What the session should say about this person right now, or null if it should end. */
export async function currentStaff(userId: string): Promise<Pick<StaffIdentity, "name" | "role"> | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, role: true, active: true } });
  return user?.active ? { name: user.name, role: user.role } : null;
}
