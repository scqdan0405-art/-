import { describe, expect, it } from "vitest";
import { parseRequiredItemPhoto } from "./photos";

const tinyPng = "data:image/png;base64,iVBORw0KGgo=";
const tinyJpeg = "data:image/jpeg;base64,/9j/";

describe("item photo validation specs/06 and specs/12.10", () => {
  it("accepts PNG and JPEG data URLs", () => {
    expect(parseRequiredItemPhoto(tinyPng).contentType).toBe("image/png");
    expect(parseRequiredItemPhoto(tinyJpeg).extension).toBe("jpg");
  });

  it("rejects missing or mismatched image payloads", () => {
    expect(() => parseRequiredItemPhoto("")).toThrow("PHOTO_REQUIRED");
    expect(() => parseRequiredItemPhoto("data:image/png;base64,AAAA")).toThrow("PHOTO_INVALID");
  });
});
