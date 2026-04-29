import { LocationsIndexPage } from "@/components/inventory/LocationsIndexPage";
import { fetchDashboardData } from "@/lib/inventory-data";

export const dynamic = "force-dynamic";

export default async function LocationsRoute({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const data = await fetchDashboardData();

  return (
    <LocationsIndexPage
      initialItems={data.items}
      initialLocations={data.locations}
      initialQuery={params.q ?? ""}
    />
  );
}
