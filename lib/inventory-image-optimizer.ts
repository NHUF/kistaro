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
  exists: boolean;
  format: string | null;
  height: number | null;
  needsOptimization: boolean;
  size: number;
  width: number | null;
};

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
      exists: false,
      format: null,
      height: null,
      needsOptimization: false,
      size: 0,
      width: null,
    };
  }

  const [metadata, stats] = await Promise.all([
    sharp(absolutePath, { limitInputPixels: false }).metadata(),
    Promise.resolve(statSync(absolutePath)),
  ]);
  const format = metadata.format ?? null;
  const width = metadata.width ?? null;
  const needsOptimization =
    format !== "jpeg" || (typeof width === "number" && width > SERVER_OPTIMIZED_IMAGE_WIDTH);

  return {
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

  const nextPath = getOptimizedImagePath(imagePath);
  const optimizedBuffer = await sharp(absolutePath, { limitInputPixels: false })
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

  writeStorageFile(INVENTORY_MEDIA_BUCKET, nextPath, optimizedBuffer);

  return {
    nextPath,
    size: optimizedBuffer.length,
  };
}
