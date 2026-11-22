"use server";

import { revalidatePath } from "next/cache";
import { ANY_ROLE, requireRole } from "@/lib/auth/guards";
import { attempt, text, type ActionState } from "@/lib/forms/action-state";
import { addPhoto } from "./photo-service";
import { MAX_PHOTO_BYTES } from "./validate";

export async function addPhotoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(...ANY_ROLE);
  const orderId = text(formData, "orderId");
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Elige una foto." };
  // Checked before the bytes are read into memory; addPhoto checks again.
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, message: "La imagen pesa más de 8 MB." };

  return attempt(async () => {
    await addPhoto(
      {
        orderId,
        bytes: new Uint8Array(await file.arrayBuffer()),
        caption: text(formData, "caption").slice(0, 200),
        isPublic: formData.get("isPublic") === "on",
      },
      actor
    );
    revalidatePath(`/admin/ordenes/${orderId}`);
  });
}
