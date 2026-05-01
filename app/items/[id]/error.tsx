"use client";

import { useEffect } from "react";
import { DetailLoadError } from "@/components/inventory/DetailLoadError";

export default function ItemDetailError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error("Unbehandelter Fehler in der Item-Detailseite:", error);
  }, [error]);

  return (
    <DetailLoadError
      entityId="unbekannt"
      entityLabel="Item"
      backHref="/items"
      backLabel="Zur Item-Uebersicht"
    />
  );
}
