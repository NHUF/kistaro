import { SystemPage } from "@/components/system/SystemPage";
import { fetchSystemStatusData } from "@/lib/system-status";

export const dynamic = "force-dynamic";

export default async function SystemRoute() {
  const status = await fetchSystemStatusData();

  return <SystemPage status={status} />;
}
