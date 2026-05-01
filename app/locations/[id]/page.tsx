import { DetailLoadError } from "@/components/inventory/DetailLoadError";
import { LocationDetailPage } from "@/components/inventory/LocationDetailPage";
import { fetchLocationDetailData } from "@/lib/inventory-data";

export const dynamic = "force-dynamic";

export default async function LocationDetailsRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let initialData = null;

  try {
    initialData = await fetchLocationDetailData(id);
  } catch (error) {
    console.error(`Location-Detailseite ${id} konnte nicht geladen werden:`, error);

    return (
      <DetailLoadError
        entityId={id}
        entityLabel="Location"
        backHref="/locations"
        backLabel="Zur Location-Uebersicht"
      />
    );
  }

  return <LocationDetailPage locationId={id} initialData={initialData} />;
}
