import { DashboardClient } from "@/components/inventory/DashboardClient";
import { fetchDashboardData } from "@/lib/inventory-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await fetchDashboardData();

  return <DashboardClient initialData={data} />;
}
