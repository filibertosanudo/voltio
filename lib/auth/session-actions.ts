"use server";

import { signOut } from "@/auth";
import { ANY_ROLE, requireRole } from "./guards";

export async function signOutAction(): Promise<void> {
  await requireRole(...ANY_ROLE);
  await signOut({ redirectTo: "/admin/login" });
}
