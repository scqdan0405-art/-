import "server-only";
import { createServiceClient } from "@/lib/db";
import type { PhotoPayload } from "@/lib/domain/photos";

const PHOTO_BUCKET = "luggage-photos";

export async function uploadItemPhoto(input: {
  bookingId: string;
  itemId: string;
  photo: PhotoPayload;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const path = `${input.bookingId}/${input.itemId}/${now.getTime()}.${input.photo.extension}`;
  const supabase = createServiceClient();
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, input.photo.buffer, {
    contentType: input.photo.contentType,
    upsert: true
  });

  if (error) {
    throw new Error(`PHOTO_UPLOAD_FAILED:${error.message}`);
  }

  return `${PHOTO_BUCKET}/${path}`;
}
