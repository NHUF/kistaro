import { supabase } from "@/lib/supabase";

export const INVENTORY_MEDIA_BUCKET = "inventory-media";
export const INVENTORY_DOCUMENT_BUCKET = "inventory-documents";
const MAX_SOURCE_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_OPTIMIZED_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const OPTIMIZED_IMAGE_WIDTH = 480;
const OPTIMIZED_IMAGE_TYPE = "image/jpeg";
const OPTIMIZED_IMAGE_QUALITY = 0.82;
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

async function loadImageFromFile(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Bild konnte nicht verarbeitet werden."));
          return;
        }

        resolve(blob);
      },
      OPTIMIZED_IMAGE_TYPE,
      OPTIMIZED_IMAGE_QUALITY,
    );
  });
}

async function optimizeInventoryImage(file: File) {
  const image = await loadImageFromFile(file);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  if (!sourceWidth || !sourceHeight) {
    throw new Error("Bild konnte nicht gelesen werden.");
  }

  const targetWidth = Math.min(sourceWidth, OPTIMIZED_IMAGE_WIDTH);
  const targetHeight = Math.max(1, Math.round((sourceHeight / sourceWidth) * targetWidth));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Bild konnte nicht verarbeitet werden.");
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const blob = await canvasToBlob(canvas);
  const baseName = file.name.replace(/\.[^.]+$/, "") || "bild";

  return new File([blob], `${baseName}.jpg`, {
    type: OPTIMIZED_IMAGE_TYPE,
    lastModified: Date.now(),
  });
}

export async function uploadInventoryImage(
  file: File,
  entityType: "items" | "locations"
) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Bitte nur Bilddateien hochladen.");
  }

  if (file.size > MAX_SOURCE_IMAGE_SIZE_BYTES) {
    throw new Error("Das Bild ist zu gross. Maximal 20 MB sind erlaubt.");
  }

  const optimizedFile = await optimizeInventoryImage(file);

  if (optimizedFile.size > MAX_OPTIMIZED_IMAGE_SIZE_BYTES) {
    throw new Error("Das optimierte Bild ist zu gross. Bitte ein kleineres Bild verwenden.");
  }

  const objectPath = `${entityType}/${Date.now()}-${createObjectId()}.jpg`;

  const { error } = await supabase.storage.from(INVENTORY_MEDIA_BUCKET).upload(objectPath, optimizedFile, {
    upsert: false,
    contentType: OPTIMIZED_IMAGE_TYPE,
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
