"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { getInventoryImageUrl } from "@/lib/inventory-media";

export function InventoryImage({
  alt,
  className = "",
  fallback,
  imagePath,
}: {
  alt: string;
  className?: string;
  fallback: ReactNode;
  imagePath: string | null | undefined;
}) {
  const imageUrl = getInventoryImageUrl(imagePath);

  if (imageUrl) {
    return <Image src={imageUrl} alt={alt} width={320} height={320} className={className} unoptimized />;
  }

  return <>{fallback}</>;
}
