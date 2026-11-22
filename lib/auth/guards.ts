import "server-only";
import { redirect } from "next/navigation";
import type { UserRole } from "@/lib/generated/prisma/enums";
import { DomainError } from "@/lib/errors";
import type { Actor } from "@/lib/orders/lock";
import { getSession } from "./session";

export const ANY_ROLE = ["OWNER", "FRONT_DESK", "TECHNICIAN"] as const satisfies readonly UserRole[];
export const COUNTER_ROLES = ["OWNER", "FRONT_DESK"] as const satisfies readonly UserRole[];
export const BENCH_ROLES = ["OWNER", "TECHNICIAN"] as const satisfies readonly UserRole[];
export const OWNER_ONLY = ["OWNER"] as const satisfies readonly UserRole[];

const LOGIN_PATH = "/admin/login";

async function currentActor(): Promise<Actor> {
  const user = (await getSession())?.user;
  if (!user || user.revoked) redirect(LOGIN_PATH);
  return { id: user.id, role: user.role, name: user.name };
}

/**
 * The first statement of every Server Action (lib/auth/guard-coverage.test.ts
 * walks them all and fails the build if one skips it). proxy.ts keeps
 * signed-out visitors off the panel's pages, but a Server Action is a
 * public POST endpoint whatever page it was imported into.
 */
export async function requireRole(...roles: readonly UserRole[]): Promise<Actor> {
  const actor = await currentActor();
  if (!roles.includes(actor.role)) throw new DomainError("FORBIDDEN");
  return actor;
}

/** For pages: someone without the role is sent to the panel's home instead of an error. */
export async function requirePageRole(...roles: readonly UserRole[]): Promise<Actor> {
  const actor = await currentActor();
  if (!roles.includes(actor.role)) redirect("/admin");
  return actor;
}
