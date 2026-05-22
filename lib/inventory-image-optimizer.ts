import { existsSync, readFileSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import heicConvert from "heic-convert";
import sharp from "sharp";
import { INVENTORY_MEDIA_BUCKET } from "@/lib/inventory-media";
import {
  resolveStoragePath,
  writeStorageFile,
} from "@/lib/local-file-storage";

export const SERVER_OPTIMIZED_IMAGE_WIDTH = 480;
const SERVER_OPTIMIZED_IMAGE_QUALITY = 82;

export type StoredInventoryImageInfo = {
  canOptimize: boolean;
  errorMessage: string | null;
  exists: boolean;
  format: string | null;
  height: number | null;
  needsOptimization: boolean;
  size: number;
  width: number | null;
};

const AUTOMATICALLY_OPTIMIZABLE_FORMATS = new Set([
  "avif",
  "gif",
  "heic",
  "heif",
  "jpeg",
  "jpg",
  "png",
  "tiff",
  "webp",
]);
const HEIC_BRANDS = ["heic", "heix", "hevc", "hevx"];

type HeicConvertResult = ArrayBuffer | Buffer | Uint8Array;

function formatImageError(error: unknown) {
  const message = error instanceof Error ? error.message : "Bilddatei konnte nicht gelesen werden.";
  const firstLine = message.split(/\r?\n/)[0]?.trim();

  return firstLine || "Bilddatei konnte nicht gelesen werden.";
}

function isHeifFormat(format: string | null) {
  return format === "heic" || format === "heif";
}

function isIsoBaseMediaFile(buffer: Buffer) {
  if (buffer.length < 12 || buffer.toString("ascii", 4, 8) !== "ftyp") {
    return false;
  }

  return true;
}

function isLikelyHeicFile(buffer: Buffer) {
  if (!isIsoBaseMediaFile(buffer)) {
    return false;
  }

  const brandText = buffer.toString("ascii", 8, Math.min(buffer.length, 48)).toLowerCase();
  return HEIC_BRANDS.some((brand) => brandText.includes(brand));
}

async function convertHeifToJpegBuffer(absolutePath: string) {
  const sourceBuffer = readFileSync(absolutePath);
  const convertedBuffer = (await heicConvert({
    buffer: sourceBuffer,
    format: "JPEG",
    quality: 0.92,
  })) as HeicConvertResult;

  if (convertedBuffer instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(convertedBuffer));
  }

  return Buffer.from(convertedBuffer);
}

async function canDecodeHeicImage(absolutePath: string) {
  try {
    await convertHeifToJpegBuffer(absolutePath);
    return null;
  } catch (error) {
    return formatImageError(error);
  }
}

function getOptimizedImagePath(imagePath: string) {
  const slashIndex = imagePath.lastIndexOf("/");
  const directory = slashIndex >= 0 ? imagePath.slice(0, slashIndex + 1) : "";
  const fileName = slashIndex >= 0 ? imagePath.slice(slashIndex + 1) : imagePath;
  const baseName = fileName.replace(/\.[^.]+$/, "") || "bild";

  return `${directory}${baseName}-${Date.now()}-${randomUUID()}.jpg`;
}

export async function inspectStoredInventoryImage(
  imagePath: string,
): Promise<StoredInventoryImageInfo | null> {
  if (!imagePath.trim()) {
    return null;
  }

  const absolutePath = resolveStoragePath(INVENTORY_MEDIA_BUCKET, imagePath);

  if (!existsSync(absolutePath)) {
    return {
      canOptimize: false,
      errorMessage: null,
      exists: false,
      format: null,
      height: null,
      needsOptimization: false,
      size: 0,
      width: null,
    };
  }

  const stats = statSync(absolutePath);
  let metadata: sharp.Metadata;

  try {
    metadata = await sharp(absolutePath, { limitInputPixels: false }).metadata();
  } catch (error) {
    const sourceBuffer = readFileSync(absolutePath);

    if (isLikelyHeicFile(sourceBuffer)) {
      const decodeError = await canDecodeHeicImage(absolutePath);

      if (decodeError) {
        return {
          canOptimize: false,
          errorMessage: `HEIC wurde erkannt, konnte aber nicht decodiert werden: ${decodeError}`,
          exists: true,
          format: "heic",
          height: null,
          needsOptimization: false,
          size: stats.size,
          width: null,
        };
      }

      return {
        canOptimize: true,
        errorMessage: null,
        exists: true,
        format: "heic",
        height: null,
        needsOptimization: true,
        size: stats.size,
        width: null,
      };
    }

    if (isIsoBaseMediaFile(sourceBuffer)) {
      return {
        canOptimize: false,
        errorMessage:
          "Die Datei ist ein HEIF/ISO-Media-Container, aber kein automatisch decodierbares HEIC-Bild.",
        exists: true,
        format: "heif",
        height: null,
        needsOptimization: false,
        size: stats.size,
        width: null,
      };
    }

    return {
      canOptimize: false,
      errorMessage: formatImageError(error),
      exists: true,
      format: null,
      height: null,
      needsOptimization: false,
      size: stats.size,
      width: null,
    };
  }

  const format = metadata.format?.toLowerCase() ?? null;
  const width = metadata.width ?? null;
  const heicDecodeError = isHeifFormat(format) ? await canDecodeHeicImage(absolutePath) : null;
  const canOptimize =
    Boolean(format && AUTOMATICALLY_OPTIMIZABLE_FORMATS.has(format)) && !heicDecodeError;
  const needsOptimization =
    canOptimize &&
    (format !== "jpeg" || (typeof width === "number" && width > SERVER_OPTIMIZED_IMAGE_WIDTH));

  return {
    canOptimize,
    errorMessage: canOptimize
      ? null
      : heicDecodeError
        ? `HEIC/HEIF wurde erkannt, konnte aber nicht decodiert werden: ${heicDecodeError}`
        : `Bildformat ${format?.toUpperCase() ?? "unbekannt"} kann auf diesem Server nicht automatisch optimiert werden.`,
    exists: true,
    format,
    height: metadata.height ?? null,
    needsOptimization,
    size: stats.size,
    width,
  };
}

export async function optimizeStoredInventoryImage(imagePath: string) {
  if (!imagePath.trim()) {
    throw new Error("Bildpfad fehlt.");
  }

  const absolutePath = resolveStoragePath(INVENTORY_MEDIA_BUCKET, imagePath);

  if (!existsSync(absolutePath)) {
    throw new Error("Bilddatei wurde nicht gefunden.");
  }

  const imageInfo = await inspectStoredInventoryImage(imagePath);

  if (!imageInfo?.canOptimize) {
    throw new Error(
      imageInfo?.errorMessage ??
        "Dieses Bild kann auf dem Server nicht automatisch optimiert werden. Bitte ersetze es durch ein JPG, PNG oder WebP.",
    );
  }

  const nextPath = getOptimizedImagePath(imagePath);
  let optimizedBuffer: Buffer;

  try {
    const source =
      isHeifFormat(imageInfo.format) || isLikelyHeicFile(readFileSync(absolutePath))
        ? await convertHeifToJpegBuffer(absolutePath)
        : absolutePath;

    optimizedBuffer = await sharp(source, { limitInputPixels: false })
      .rotate()
      .resize({
        width: SERVER_OPTIMIZED_IMAGE_WIDTH,
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({
        quality: SERVER_OPTIMIZED_IMAGE_QUALITY,
        mozjpeg: true,
      })
      .toBuffer();
  } catch (error) {
    throw new Error(
      `Bild konnte nicht automatisch optimiert werden: ${formatImageError(error)}. Bitte ersetze es durch ein neues JPG, PNG oder WebP.`,
    );
  }

  writeStorageFile(INVENTORY_MEDIA_BUCKET, nextPath, optimizedBuffer);

  return {
    nextPath,
    size: optimizedBuffer.length,
  };
}
