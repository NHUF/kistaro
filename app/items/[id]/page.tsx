import { DetailLoadError } from "@/components/inventory/DetailLoadError";
import { ItemDetailPage } from "@/components/inventory/ItemDetailPage";
import { fetchItemDetailData } from "@/lib/inventory-data";

export const dynamic = "force-dynamic";

export default async function ItemDetailsRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let initialData = null;

  try {
    initialData = await fetchItemDetailData(id);
  } catch (error) {
    console.error(`Item-Detailseite ${id} konnte nicht geladen werden:`, error);

    return (
      <DetailLoadError
        entityId={id}
        entityLabel="Item"
        backHref="/items"
        backLabel="Zur Item-Uebersicht"
      />
    );
  }

  return <ItemDetailPage itemId={id} initialData={initialData} />;
}
