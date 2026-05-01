"use client";

import { useEffect, useId, useMemo, type ReactNode } from "react";
import Image from "next/image";
import { InventoryImage } from "@/components/inventory/InventoryImage";
import { Button } from "@/components/ui/Button";
import { getInventoryImageUrl } from "@/lib/inventory-media";

export function ImagePicker({
  currentImagePath,
  label = "Bild",
  onFileChange,
  onRemoveChange,
  pendingFile,
  removeImage,
  fallback,
}: {
  currentImagePath: string | null | undefined;
  label?: string;
  onFileChange: (file: File | null) => void;
  onRemoveChange: (remove: boolean) => void;
  pendingFile: File | null;
  removeImage: boolean;
  fallback: ReactNode;
}) {
  const inputId = useId();
  const libraryInputId = `${inputId}-library`;
  const cameraInputId = `${inputId}-camera`;
  const previewUrl = useMemo(() => {
    if (!pendingFile) {
      return null;
    }

    return URL.createObjectURL(pendingFile);
  }, [pendingFile]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const currentUrl = useMemo(() => {
    if (removeImage || previewUrl) {
      return null;
    }

    return getInventoryImageUrl(currentImagePath);
  }, [currentImagePath, previewUrl, removeImage]);

  function handleFileSelect(file: File | null) {
    onFileChange(file);
    if (file) {
      onRemoveChange(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 p-3 dark:border-gray-700">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</label>
        {pendingFile ? (
          <span className="text-xs text-gray-400">{pendingFile.name}</span>
        ) : currentImagePath && !removeImage ? (
          <span className="text-xs text-gray-400">Vorhandenes Bild</span>
        ) : (
          <span className="text-xs text-gray-400">Kein Bild</span>
        )}
      </div>

      <input
        id={libraryInputId}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif"
        onChange={(event) => {
          handleFileSelect(event.target.files?.[0] ?? null);
          event.currentTarget.value = "";
        }}
        className="sr-only"
      />
      <input
        id={cameraInputId}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => {
          handleFileSelect(event.target.files?.[0] ?? null);
          event.currentTarget.value = "";
        }}
        className="sr-only"
      />

      <div className="overflow-hidden rounded-2xl border border-dashed border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40">
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt="Bildvorschau"
            width={640}
            height={320}
            className="h-40 w-full object-cover"
            unoptimized
          />
        ) : currentUrl ? (
          <InventoryImage
            alt="Aktuelles Bild"
            imagePath={currentImagePath}
            className="h-40 w-full object-cover"
            fallback={fallback}
          />
        ) : (
          <div className="flex h-40 w-full items-center justify-center">{fallback}</div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <label
            htmlFor={libraryInputId}
            className="inline-flex cursor-pointer items-center rounded-md px-3 py-1 text-sm font-medium text-gray-800 transition hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            Bild auswaehlen
          </label>
          <label
            htmlFor={cameraInputId}
            className="inline-flex cursor-pointer items-center rounded-md px-3 py-1 text-sm font-medium text-gray-800 transition hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            Hauptkamera oeffnen
          </label>
        </div>
        <p className="text-xs text-gray-400">
          Auf dem Handy versucht <span className="font-medium">Hauptkamera oeffnen</span> direkt die Rueckkamera zu nutzen.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            onFileChange(null);
            onRemoveChange(Boolean(currentImagePath));
          }}
        >
          Bild entfernen
        </Button>
        {(pendingFile || removeImage) && currentImagePath ? (
          <Button
            variant="ghost"
            onClick={() => {
              onFileChange(null);
              onRemoveChange(false);
            }}
          >
            Entfernen rueckgaengig
          </Button>
        ) : null}
      </div>
    </div>
  );
}
