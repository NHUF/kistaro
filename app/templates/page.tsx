import { TemplatesIndexPage } from "@/components/inventory/TemplatesIndexPage";
import { fetchAvailableTags, fetchTemplatesOverview } from "@/lib/inventory-data";

export const dynamic = "force-dynamic";

export default async function TemplatesRoute({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const [templates, availableTags] = await Promise.all([
    fetchTemplatesOverview(),
    fetchAvailableTags(),
  ]);

  return <TemplatesIndexPage templates={templates} availableTags={availableTags} initialQuery={params.q ?? ""} />;
}
