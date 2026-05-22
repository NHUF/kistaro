import { existsSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
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
  "jpeg",
  "jpg",
  "png",
  "tiff",
  "webp",
]);

function formatImageError(error: unknown) {
  const message = error instanceof Error ? error.message : "Bilddatei konnte nicht gelesen werden.";
  const firstLine = message.split(/\r?\n/)[0]?.trim();

  return firstLine || "Bilddatei konnte nicht gelesen werden.";
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
  const canOptimize = Boolean(format && AUTOMATICALLY_OPTIMIZABLE_FORMATS.has(format));
  const needsOptimization =
    canOptimize &&
    (format !== "jpeg" || (typeof width === "number" && width > SERVER_OPTIMIZED_IMAGE_WIDTH));

  return {
    canOptimize,
    errorMessage: canOptimize
      ? null
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
    optimizedBuffer = await sharp(absolutePath, { limitInputPixels: false })
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
