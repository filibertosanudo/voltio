import "server-only";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { lockOrder, type Actor } from "@/lib/orders/lock";
import { photoStorage, type PhotoStorage } from "./storage";
import { MAX_PHOTO_BYTES, sniffImageType } from "./validate";

export type PhotoInput = { orderId: string; bytes: Uint8Array; caption: string; isPublic: boolean };

/**
 * Attaches a photo to an order: the state the device arrived in, the
 * damage found, the finished repair. The bytes are written before the row,
 * so a row never points at a file that does not exist; a failed
 * transaction leaves at worst an unreferenced file.
 */
export async function addPhoto(
  input: PhotoInput,
  actor: Actor,
  storage: PhotoStorage = photoStorage(),
  now = new Date()
): Promise<string> {
  if (input.bytes.byteLength > MAX_PHOTO_BYTES) throw new DomainError("IMAGE_TOO_LARGE");
  const type = sniffImageType(input.bytes);
  if (!type) throw new DomainError("INVALID_IMAGE");

  const exists = await prisma.order.findUnique({ where: { id: input.orderId }, select: { id: true } });
  if (!exists) throw new DomainError("NOT_FOUND");

  const storageKey = `${input.orderId}/${createId()}.${type.extension}`;
  await storage.put(storageKey, input.bytes);

  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, input.orderId);
    const photo = await tx.orderPhoto.create({
      data: {
        orderId: input.orderId,
        storageKey,
        contentType: type.contentType,
        sizeBytes: input.bytes.byteLength,
        caption: input.caption.trim(),
        isPublic: input.isPublic,
        uploadedById: actor.id,
        createdAt: now,
      },
      select: { id: true },
    });
    await tx.orderEvent.create({
      data: {
        orderId: input.orderId,
        type: "PHOTO_ADDED",
        message: input.caption.trim() || "Se agregó una foto a la orden.",
        isPublic: input.isPublic,
        actorId: actor.id,
        createdAt: now,
      },
    });
    return photo.id;
  });
}
