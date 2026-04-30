import type { ItemStatus, LocationType } from "@/lib/inventory";

export type DashboardLocation = {
  id: string;
  name: string;
  parent_id: string | null;
  type: LocationType | null;
  value?: number | null;
  icon_name?: string | null;
  image_path?: string | null;
  description?: string;
  created_at?: string;
  children?: DashboardLocation[];
};

export type DashboardItem = {
  id: string;
  name: string;
  location_id: string | null;
  description?: string | null;
  value?: number | null;
  purchase_date?: string | null;
  status?: ItemStatus | null;
  icon_name?: string | null;
  image_path?: string | null;
  created_at?: string;
};

export type InventoryTemplate = {
  id: string;
  entity_type: "item" | "location";
  name: string;
  description?: string | null;
  location_type?: LocationType | null;
  item_status?: ItemStatus | null;
  icon_name?: string | null;
  image_path?: string | null;
  item_value?: number | null;
  item_purchase_date?: string | null;
  location_value?: number | null;
};

export type DeleteStrategy = "unpack" | "box" | "delete";

export type TagUsage = {
  id: string;
  name: string;
  item_count: number;
  location_count: number;
};
