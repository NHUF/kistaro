import { ItemsIndexPage } from "@/components/inventory/ItemsIndexPage";
import { fetchDashboardData } from "@/lib/inventory-data";

export const dynamic = "force-dynamic";

export default async function ItemsRoute({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const data = await fetchDashboardData();

  return (
    <ItemsIndexPage
      initialItems={data.items}
      locations={data.locations}
      initialQuery={params.q ?? ""}
    />
  );
}
