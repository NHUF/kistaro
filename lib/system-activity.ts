import { query } from "@/lib/db";

export async function logSystemActivity({
  description = null,
  metadata = {},
  title,
}: {
  description?: string | null;
  metadata?: Record<string, unknown>;
  title: string;
}) {
  await query(
    `select public.log_inventory_activity(
      $1, $2, $3, $4, $5, $6, $7::jsonb
    )`,
    [
      "system",
      null,
      "update",
      title,
      description,
      "System",
      JSON.stringify(metadata),
    ],
  ).catch(() => undefined);
}
