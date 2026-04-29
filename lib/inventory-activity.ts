import { supabase } from "@/lib/supabase";
import { getDeviceActorLabel } from "@/lib/device-actor";

export type InventoryActivityAction =
  | "create"
  | "update"
  | "delete"
  | "move"
  | "attach"
  | "detach";

export async function logInventoryActivity({
  action,
  description = null,
  entityId = null,
  entityType,
  metadata = {},
  title,
}: {
  action: InventoryActivityAction;
  description?: string | null;
  entityId?: string | null;
  entityType: string;
  metadata?: Record<string, unknown>;
  title: string;
}) {
  const actorLabel = getDeviceActorLabel();

  const { error } = await supabase.rpc("log_inventory_activity", {
    event_action: action,
    event_actor_label: actorLabel,
    event_description: description,
    event_entity_id: entityId,
    event_entity_type: entityType,
    event_metadata: metadata,
    event_title: title,
  });

  if (error) {
    console.warn("Aktivitätslog konnte nicht geschrieben werden:", error.message);
  }
}
