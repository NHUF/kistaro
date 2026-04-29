import { ItemDetailPage } from "@/components/inventory/ItemDetailPage";
import { fetchItemDetailData } from "@/lib/inventory-data";

export const dynamic = "force-dynamic";

export default async function ItemDetailsRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initialData = await fetchItemDetailData(id);

  return <ItemDetailPage itemId={id} initialData={initialData} />;
}
