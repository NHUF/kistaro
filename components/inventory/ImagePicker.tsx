"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
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
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
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
        ref={libraryInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif"
        onChange={(event) => {
          handleFileSelect(event.target.files?.[0] ?? null);
          event.currentTarget.value = "";
        }}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => {
          handleFileSelect(event.target.files?.[0] ?? null);
          event.currentTarget.value = "";
        }}
        className="hidden"
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
          <Button variant="ghost" onClick={() => libraryInputRef.current?.click()}>
            Bild auswaehlen
          </Button>
          <Button variant="ghost" onClick={() => cameraInputRef.current?.click()}>
            Foto aufnehmen
          </Button>
        </div>
        <p className="text-xs text-gray-400">
          Auf dem Handy oeffnet <span className="font-medium">Foto aufnehmen</span> direkt die Kamera.
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
