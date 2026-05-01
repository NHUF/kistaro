"use client";

import { useEffect } from "react";
import { DetailLoadError } from "@/components/inventory/DetailLoadError";

export default function LocationDetailError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error("Unbehandelter Fehler in der Location-Detailseite:", error);
  }, [error]);

  return (
    <DetailLoadError
      entityId="unbekannt"
      entityLabel="Location"
      backHref="/locations"
      backLabel="Zur Location-Uebersicht"
    />
  );
}
