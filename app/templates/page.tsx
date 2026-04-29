import { TemplatesIndexPage } from "@/components/inventory/TemplatesIndexPage";
import { fetchTemplatesOverview } from "@/lib/inventory-data";

export const dynamic = "force-dynamic";

export default async function TemplatesRoute({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const templates = await fetchTemplatesOverview();

  return <TemplatesIndexPage templates={templates} initialQuery={params.q ?? ""} />;
}
