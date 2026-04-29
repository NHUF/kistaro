import { TagDetailPage } from "@/components/inventory/TagDetailPage";
import { fetchTagDetailData } from "@/lib/inventory-data";

export const dynamic = "force-dynamic";

export default async function TagDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initialData = await fetchTagDetailData(id);

  return <TagDetailPage initialData={initialData} />;
}
