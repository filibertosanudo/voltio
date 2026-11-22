import { getSession } from "@/lib/auth/session";
import { photoStorage } from "@/lib/photos/storage";
import { prisma } from "@/lib/prisma";

const notFound = () => new Response("Not found", { status: 404 });

/**
 * Serves an order photo. Two ways in: a signed-in staff member, or the
 * order's tracking token for a photo marked public. Anything else is a
 * 404, the same answer as a photo that does not exist.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const photo = await prisma.orderPhoto.findUnique({
    where: { id },
    select: { storageKey: true, contentType: true, isPublic: true, order: { select: { publicToken: true } } },
  });
  if (!photo) return notFound();

  const token = new URL(request.url).searchParams.get("t");
  const byToken = photo.isPublic && token !== null && token === photo.order.publicToken;
  if (!byToken) {
    const user = (await getSession())?.user;
    if (!user || user.revoked) return notFound();
  }

  const bytes = await photoStorage().get(photo.storageKey);
  if (!bytes) return notFound();

  return new Response(new Uint8Array(bytes), {
    headers: {
      // The type found in the file's own bytes at upload, never a client's claim.
      "Content-Type": photo.contentType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
