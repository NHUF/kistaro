import { supabase } from "@/lib/supabase";

export const INVENTORY_MEDIA_BUCKET = "inventory-media";
export const INVENTORY_DOCUMENT_BUCKET = "inventory-documents";
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

function createObjectId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getInventoryImageUrl(path: string | null | undefined) {
  if (!path) {
    return null;
  }

  const { data } = supabase.storage.from(INVENTORY_MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadInventoryImage(
  file: File,
  entityType: "items" | "locations"
) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Bitte nur Bilddateien hochladen.");
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("Das Bild ist zu gross. Maximal 5 MB sind erlaubt.");
  }

  const extension = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() ?? "jpg" : "jpg";
  const objectPath = `${entityType}/${Date.now()}-${createObjectId()}.${extension}`;

  const { error } = await supabase.storage.from(INVENTORY_MEDIA_BUCKET).upload(objectPath, file, {
    upsert: false,
    contentType: file.type,
  });

  if (error) {
    throw new Error(error.message);
  }

  return objectPath;
}

export async function removeInventoryImage(path: string | null | undefined) {
  if (!path) {
    return;
  }

  const { error } = await supabase.storage.from(INVENTORY_MEDIA_BUCKET).remove([path]);

  if (error) {
    throw new Error(error.message);
  }
}

export function getInventoryDocumentUrl(path: string | null | undefined) {
  if (!path) {
    return null;
  }

  const { data } = supabase.storage.from(INVENTORY_DOCUMENT_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadInventoryDocument(file: File) {
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    throw new Error("Das Dokument ist zu gross. Maximal 10 MB sind erlaubt.");
  }

  const extension = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() ?? "bin" : "bin";
  const objectPath = `items/${Date.now()}-${createObjectId()}.${extension}`;

  const { error } = await supabase.storage.from(INVENTORY_DOCUMENT_BUCKET).upload(objectPath, file, {
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });

  if (error) {
    throw new Error(error.message);
  }

  return objectPath;
}

export async function removeInventoryDocument(path: string | null | undefined) {
  if (!path) {
    return;
  }

  const { error } = await supabase.storage.from(INVENTORY_DOCUMENT_BUCKET).remove([path]);

  if (error) {
    throw new Error(error.message);
  }
}
