import crypto from "crypto";
import fs from "fs";
import path from "path";

export const SUPPORTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"];
export const DEFAULT_IMAGE_LIMITS = {
  minBytes: 1000,
  maxBytes: 2_000_000,
  minWidth: 120,
  minHeight: 70,
  maxWidth: 3000,
  maxHeight: 2000,
};

export function slugifyCardName(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

export function normalizeExtension(value, fallback = ".png") {
  const extension = value ? value.toLowerCase() : fallback;
  const normalized = extension.startsWith(".") ? extension : `.${extension}`;
  if (normalized === ".jpeg") return ".jpg";
  return SUPPORTED_IMAGE_EXTENSIONS.includes(normalized) ? normalized : fallback;
}

export function filenameForCardImage(cardName, extension = ".png") {
  return `${slugifyCardName(cardName)}${normalizeExtension(extension)}`;
}

export function imageHash(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function detectImageType(buffer) {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer.toString("ascii", 1, 4) === "PNG") {
    return "png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "webp";
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp" && buffer.toString("ascii", 8, 12).startsWith("avif")) {
    return "avif";
  }
  if (buffer.length >= 6 && (buffer.toString("ascii", 0, 6) === "GIF87a" || buffer.toString("ascii", 0, 6) === "GIF89a")) {
    return "gif";
  }
  return null;
}

export function readImageDimensions(buffer) {
  const type = detectImageType(buffer);

  if (type === "png" && buffer.length >= 24) {
    return { type, width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  if (type === "gif" && buffer.length >= 10) {
    return { type, width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }

  if (type === "webp" && buffer.length >= 30) {
    const variant = buffer.toString("ascii", 12, 16);
    if (variant === "VP8X" && buffer.length >= 30) {
      const width = 1 + buffer.readUIntLE(24, 3);
      const height = 1 + buffer.readUIntLE(27, 3);
      return { type, width, height };
    }
    if (variant === "VP8 " && buffer.length >= 30) {
      return {
        type,
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff,
      };
    }
    if (variant === "VP8L" && buffer.length >= 25) {
      const bits = buffer.readUInt32LE(21);
      return {
        type,
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
  }

  if (type === "avif") {
    const ispeIndex = buffer.indexOf("ispe", 0, "ascii");
    if (ispeIndex >= 4 && ispeIndex + 16 <= buffer.length) {
      return {
        type,
        width: buffer.readUInt32BE(ispeIndex + 8),
        height: buffer.readUInt32BE(ispeIndex + 12),
      };
    }
  }

  if (type === "jpg") {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2) break;
      const isStartOfFrame =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);
      if (isStartOfFrame) {
        return {
          type,
          width: buffer.readUInt16BE(offset + 7),
          height: buffer.readUInt16BE(offset + 5),
        };
      }
      offset += 2 + length;
    }
  }

  return { type, width: null, height: null };
}

export function validateImageBuffer(buffer, limits = DEFAULT_IMAGE_LIMITS) {
  const errors = [];
  const warnings = [];
  const metadata = readImageDimensions(buffer);
  const sizeBytes = buffer.length;

  if (!metadata.type) errors.push("Unsupported or corrupt image signature");
  if (sizeBytes < limits.minBytes) errors.push(`File is too small (${sizeBytes} bytes)`);
  if (sizeBytes > limits.maxBytes) warnings.push(`File is large (${sizeBytes} bytes)`);

  if (metadata.width === null || metadata.height === null) {
    warnings.push("Could not read image dimensions");
  } else {
    if (metadata.width < limits.minWidth || metadata.height < limits.minHeight) {
      errors.push(`Image is too small (${metadata.width}x${metadata.height})`);
    }
    if (metadata.width > limits.maxWidth || metadata.height > limits.maxHeight) {
      warnings.push(`Image is very large (${metadata.width}x${metadata.height})`);
    }
  }

  const firstBytes = buffer.subarray(0, 128).toString("ascii").toLowerCase();
  if (firstBytes.includes("<html") || firstBytes.includes("<!doctype")) {
    errors.push("Downloaded content looks like HTML, not an image");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    metadata,
    sizeBytes,
    sha256: imageHash(buffer),
  };
}

export function extensionMatchesImageType(filepath, imageType) {
  const extension = path.extname(filepath).toLowerCase();
  if (!imageType || !extension) return true;
  if (imageType === "jpg") return extension === ".jpg" || extension === ".jpeg";
  return extension === `.${imageType}`;
}

export async function validateImageFile(filepath, limits = DEFAULT_IMAGE_LIMITS) {
  const buffer = await fs.promises.readFile(filepath);
  const result = validateImageBuffer(buffer, limits);
  if (!extensionMatchesImageType(filepath, result.metadata.type)) {
    result.warnings.push(
      `File extension ${path.extname(filepath)} does not match detected ${result.metadata.type} content`
    );
  }
  return {
    path: filepath,
    ...result,
  };
}

export async function findDuplicateImageHashes(outputDir, targetHash, excludePath = null) {
  const files = await fs.promises.readdir(outputDir);
  const duplicates = [];

  for (const file of files) {
    const filepath = path.join(outputDir, file);
    const stat = await fs.promises.stat(filepath);
    if (!stat.isFile() || !SUPPORTED_IMAGE_EXTENSIONS.includes(path.extname(file).toLowerCase())) continue;
    if (excludePath && path.resolve(filepath) === path.resolve(excludePath)) continue;

    const buffer = await fs.promises.readFile(filepath);
    if (imageHash(buffer) === targetHash) {
      duplicates.push(filepath);
    }
  }

  return duplicates;
}
