import {
  filenameForCardImage,
  normalizeExtension,
  readImageDimensions,
  slugifyCardName,
  validateImageBuffer,
  extensionMatchesImageType,
} from "../card-image-utils.js";

function pngBuffer(width = 160, height = 100) {
  const buffer = Buffer.alloc(64);
  buffer[0] = 0x89;
  buffer.write("PNG", 1, "ascii");
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

describe("card image utilities", () => {
  it("normalizes card image filenames deterministically", () => {
    expect(slugifyCardName("Hilton Honors® American Express & Business Card")).toBe(
      "hilton-honors-american-express-and-business-card"
    );
    expect(filenameForCardImage("Citi Strata Elite", ".jpeg")).toBe("citi-strata-elite.jpg");
    expect(normalizeExtension("webp")).toBe(".webp");
  });

  it("reads basic PNG dimensions and validates constraints", () => {
    const validation = validateImageBuffer(pngBuffer(), {
      minBytes: 1,
      maxBytes: 1000,
      minWidth: 120,
      minHeight: 70,
      maxWidth: 3000,
      maxHeight: 2000,
    });

    expect(readImageDimensions(pngBuffer())).toMatchObject({ type: "png", width: 160, height: 100 });
    expect(validation.ok).toBe(true);
    expect(validation.sha256).toHaveLength(64);
  });

  it("rejects non-image content", () => {
    const validation = validateImageBuffer(Buffer.from("<!doctype html><html></html>"), {
      minBytes: 1,
      maxBytes: 1000,
      minWidth: 1,
      minHeight: 1,
      maxWidth: 3000,
      maxHeight: 2000,
    });

    expect(validation.ok).toBe(false);
    expect(validation.errors.join(" ")).toContain("HTML");
  });

  it("detects mismatched filename extensions", () => {
    expect(extensionMatchesImageType("card.png", "png")).toBe(true);
    expect(extensionMatchesImageType("card.jpeg", "jpg")).toBe(true);
    expect(extensionMatchesImageType("card.png", "avif")).toBe(false);
  });
});
