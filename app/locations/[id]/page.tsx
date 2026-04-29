import { LocationDetailPage } from "@/components/inventory/LocationDetailPage";
import { fetchLocationDetailData } from "@/lib/inventory-data";

export const dynamic = "force-dynamic";

export default async function LocationDetailsRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initialData = await fetchLocationDetailData(id);

  return <LocationDetailPage locationId={id} initialData={initialData} />;
}
