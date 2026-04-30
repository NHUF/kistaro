import { queryRows } from "@/lib/db";

type RpcDefinition = {
  params: string[];
  fallbackParamCounts?: number[];
  returnsRows?: boolean;
};

const RPC_DEFINITIONS: Record<string, RpcDefinition> = {
  search_inventory: { params: ["search_term"], returnsRows: true },
  create_inventory_template: {
    params: [
      "template_entity_type",
      "base_name",
      "template_description",
      "template_location_type",
      "template_item_status",
      "template_icon_name",
      "template_image_path",
      "template_item_value",
      "template_item_purchase_date",
      "template_location_value",
    ],
    fallbackParamCounts: [9],
  },
  update_inventory_template: {
    params: [
      "target_template_id",
      "base_name",
      "template_description",
      "template_location_type",
      "template_item_status",
      "template_icon_name",
      "template_image_path",
      "template_item_value",
      "template_item_purchase_date",
      "template_location_value",
    ],
    fallbackParamCounts: [9],
  },
  delete_inventory_template: { params: ["target_template_id"] },
  create_item_from_template: { params: ["template_id", "target_location"] },
  create_location_from_template: { params: ["template_id", "parent_location"] },
  create_location: {
    params: [
      "loc_name",
      "loc_type",
      "parent_location",
      "loc_description",
      "loc_icon_name",
      "loc_image_path",
      "loc_value",
    ],
    fallbackParamCounts: [6],
  },
  update_location: {
    params: [
      "loc_id",
      "loc_name",
      "loc_type",
      "parent_location",
      "loc_description",
      "loc_icon_name",
      "loc_image_path",
      "loc_value",
    ],
    fallbackParamCounts: [7],
  },
  move_location: { params: ["loc_id", "new_parent"] },
  delete_location: { params: ["loc_id", "strategy"] },
  create_item: {
    params: [
      "item_name",
      "target_location",
      "item_icon_name",
      "item_image_path",
      "item_description",
      "item_value",
      "item_purchase_date",
      "item_status",
    ],
    fallbackParamCounts: [4],
  },
  update_item_details: {
    params: [
      "item_id",
      "item_name",
      "item_description",
      "item_value",
      "item_purchase_date",
      "item_status",
      "item_icon_name",
      "item_image_path",
    ],
  },
  move_item: { params: ["item_id", "target_location"] },
  delete_item: { params: ["item_id"] },
  attach_item_tag: { params: ["target_item_id", "tag_name"] },
  detach_item_tag: { params: ["target_item_id", "target_tag_id"] },
  attach_location_tag: { params: ["target_location_id", "tag_name"] },
  detach_location_tag: { params: ["target_location_id", "target_tag_id"] },
  create_item_document: {
    params: ["target_item_id", "document_title", "document_type", "document_file_path"],
  },
  delete_item_document: { params: ["target_document_id"] },
  attach_item_link: { params: ["source_item_id", "target_item_id"] },
  detach_item_link: { params: ["source_item_id", "target_item_id"] },
  create_resource_link: {
    params: ["target_entity_type", "target_entity_id", "link_label", "link_url"],
  },
  delete_resource_link: { params: ["target_link_id"] },
  log_inventory_activity: {
    params: [
      "event_entity_type",
      "event_entity_id",
      "event_action",
      "event_title",
      "event_description",
      "event_actor_label",
      "event_metadata",
    ],
  },
};

function quoteFunctionName(name: string) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Ungültiger Funktionsname: ${name}`);
  }

  return `"${name}"`;
}

export async function executeLocalRpc<T = unknown>(name: string, params: Record<string, unknown>) {
  try {
    const definition = RPC_DEFINITIONS[name];

    if (!definition) {
      throw new Error(`RPC ist nicht registriert: ${name}`);
    }

    const functionName = quoteFunctionName(name);
    const paramCounts = [definition.params.length, ...(definition.fallbackParamCounts ?? [])];
    let lastError: unknown = null;

    for (const paramCount of paramCounts) {
      const values = definition.params
        .slice(0, paramCount)
        .map((paramName) => params[paramName] ?? null);
      const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");

      try {
        if (definition.returnsRows) {
          const rows = await queryRows<T & Record<string, unknown>>(
            `select * from public.${functionName}(${placeholders})`,
            values,
          );

          return { data: rows as T, error: null };
        }

        const rows = await queryRows<{ value: T }>(
          `select public.${functionName}(${placeholders}) as value`,
          values,
        );

        return { data: rows[0]?.value ?? null, error: null };
      } catch (error) {
        lastError = error;

        if (
          paramCount === paramCounts[paramCounts.length - 1] ||
          !(error instanceof Error) ||
          !error.message.includes("function public.")
        ) {
          throw error;
        }
      }
    }

    throw lastError;
  } catch (error) {
    return {
      data: null as T,
      error: {
        message: error instanceof Error ? error.message : "Lokaler RPC-Aufruf fehlgeschlagen.",
      },
    };
  }
}
