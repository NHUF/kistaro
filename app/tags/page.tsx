import { TagsIndexPage } from "@/components/inventory/TagsIndexPage";
import { fetchTagsOverview } from "@/lib/inventory-data";

export const dynamic = "force-dynamic";

export default async function TagsRoute({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const tags = await fetchTagsOverview();

  return <TagsIndexPage tags={tags} initialQuery={params.q ?? ""} />;
}
