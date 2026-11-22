import { prisma } from "@/lib/prisma";

/** For the container healthcheck and an uptime monitor: is the app up, and can it reach its database. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
