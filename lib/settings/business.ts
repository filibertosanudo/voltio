import "server-only";
import { cache } from "react";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

/** "Lunes a viernes" / "9:00 a 19:00". Free text on purpose: shops describe their hours in more ways than a time picker allows. */
export const hoursSchema = z
  .array(z.object({ label: z.string().trim().min(1).max(40), value: z.string().trim().min(1).max(40) }))
  .max(7);

export type OpeningHours = z.infer<typeof hoursSchema>;

/** The shop's settings, read once per request. The row always exists: the first migration inserts it. */
export const getBusiness = cache(async () => {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: "main" } });
  const hours = hoursSchema.safeParse(business.hours);
  return { ...business, hours: hours.success ? hours.data : [] };
});

export type BusinessSettings = Awaited<ReturnType<typeof getBusiness>>;
