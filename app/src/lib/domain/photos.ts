export type PhotoPayload = {
  contentType: "image/jpeg" | "image/png";
  extension: "jpg" | "png";
  buffer: Buffer;
};

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function parseRequiredItemPhoto(photoBase64: string, maxBytes = MAX_PHOTO_BYTES): PhotoPayload {
  const match = photoBase64.match(/^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!match) {
    throw new Error("PHOTO_REQUIRED");
  }

  const contentType = match[1] as PhotoPayload["contentType"];
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (buffer.length === 0 || buffer.length > maxBytes) {
    throw new Error("PHOTO_INVALID");
  }

  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  if ((contentType === "image/jpeg" && !isJpeg) || (contentType === "image/png" && !isPng)) {
    throw new Error("PHOTO_INVALID");
  }

  return {
    contentType,
    extension: contentType === "image/jpeg" ? "jpg" : "png",
    buffer
  };
}
