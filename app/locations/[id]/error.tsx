"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { DetailLoadError } from "@/components/inventory/DetailLoadError";

export default function LocationDetailError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const pathname = usePathname();
  const entityId = pathname.split("/").filter(Boolean).at(-1) ?? "unbekannt";

  useEffect(() => {
    console.error("Unbehandelter Fehler in der Location-Detailseite:", error);
  }, [error]);

  return (
    <DetailLoadError
      entityId={entityId}
      entityLabel="Location"
      backHref="/locations"
      backLabel="Zur Location-Uebersicht"
    />
  );
}
