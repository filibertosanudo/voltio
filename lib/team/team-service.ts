import "server-only";
import type { UserRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { generateTemporaryPassword, hashPassword } from "@/lib/auth/password";

/** Creates a staff account and returns the temporary password, which is shown once and stored only as a hash. */
export async function createStaff(input: { name: string; email: string; role: UserRole }): Promise<string> {
  const email = input.email.trim().toLowerCase();
  const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (taken) throw new DomainError("EMAIL_TAKEN");

  const password = generateTemporaryPassword();
  await prisma.user.create({
    data: { name: input.name.trim(), email, role: input.role, passwordHash: await hashPassword(password) },
  });
  return password;
}

export async function resetStaffPassword(userId: string): Promise<string> {
  const password = generateTemporaryPassword();
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } });
  return password;
}

/**
 * Deactivating never deletes: the person's name stays on every order they
 * touched. The shop can never be left without an active owner, checked
 * under a lock so two owners deactivating each other cannot both succeed.
 */
export async function setStaffActive(userId: string, active: boolean): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const owners = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "User" WHERE "role" = 'OWNER' AND "active" = true FOR UPDATE
    `;
    const target = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!target) throw new DomainError("NOT_FOUND");
    if (!active && target.role === "OWNER" && owners.every((owner) => owner.id === userId)) {
      throw new DomainError("LAST_OWNER");
    }
    await tx.user.update({ where: { id: userId }, data: { active } });
  });
}
