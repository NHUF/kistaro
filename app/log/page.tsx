import { LogIndexPage } from "@/components/inventory/LogIndexPage";
import { fetchInventoryActivity } from "@/lib/inventory-data";

export const dynamic = "force-dynamic";

export default async function LogPage() {
  const activity = await fetchInventoryActivity();

  return <LogIndexPage activity={activity} />;
}
