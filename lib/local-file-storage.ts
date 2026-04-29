import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const STORAGE_ROOT = resolve(process.cwd(), process.env.INVENTORY_STORAGE_DIR || "storage", "uploads");

function assertSafePath(path: string) {
  if (path.includes("..") || path.startsWith("/") || path.startsWith("\\")) {
    throw new Error("Ungültiger Dateipfad.");
  }
}

export function getStorageRoot() {
  return STORAGE_ROOT;
}

export function resolveStoragePath(bucket: string, path: string) {
  assertSafePath(bucket);
  assertSafePath(path);
  return resolve(STORAGE_ROOT, bucket, path);
}

export function writeStorageFile(bucket: string, path: string, buffer: Buffer) {
  const targetPath = resolveStoragePath(bucket, path);
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, buffer);
}

export function readStorageFile(bucket: string, path: string) {
  const targetPath = resolveStoragePath(bucket, path);

  if (!existsSync(targetPath)) {
    return null;
  }

  return readFileSync(targetPath);
}

export function removeStorageFile(bucket: string, path: string) {
  const targetPath = resolveStoragePath(bucket, path);

  if (existsSync(targetPath)) {
    rmSync(targetPath, { force: true });
    return true;
  }

  return false;
}

export function getContentType(path: string) {
  const lowerPath = path.toLowerCase();

  if (lowerPath.endsWith(".png")) return "image/png";
  if (lowerPath.endsWith(".jpg") || lowerPath.endsWith(".jpeg")) return "image/jpeg";
  if (lowerPath.endsWith(".webp")) return "image/webp";
  if (lowerPath.endsWith(".gif")) return "image/gif";
  if (lowerPath.endsWith(".pdf")) return "application/pdf";
  if (lowerPath.endsWith(".txt")) return "text/plain; charset=utf-8";

  return "application/octet-stream";
}
