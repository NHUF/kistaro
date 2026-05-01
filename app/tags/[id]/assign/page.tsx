import { TagAssignPage } from "@/components/inventory/TagAssignPage";
import { fetchTagAssignmentData } from "@/lib/inventory-data";

export const dynamic = "force-dynamic";

export default async function TagAssignRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initialData = await fetchTagAssignmentData(id);

  return <TagAssignPage initialData={initialData} tagId={id} />;
}
