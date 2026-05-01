"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { DetailLoadError } from "@/components/inventory/DetailLoadError";

export default function ItemDetailError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const pathname = usePathname();
  const entityId = pathname.split("/").filter(Boolean).at(-1) ?? "unbekannt";

  useEffect(() => {
    console.error("Unbehandelter Fehler in der Item-Detailseite:", error);
  }, [error]);

  return (
    <DetailLoadError
      entityId={entityId}
      entityLabel="Item"
      backHref="/items"
      backLabel="Zur Item-Uebersicht"
    />
  );
}
