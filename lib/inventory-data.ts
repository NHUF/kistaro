import {
  getItemStatusLabel,
  getLocationTypeLabel,
  type ItemStatus,
  type LocationType,
  type Tag,
} from "@/lib/inventory";
import { normalizeNullableDateValue } from "@/lib/inventory-dates";
import { supabase } from "@/lib/supabase";

export type LocationRecord = {
  id: string;
  name: string;
  parent_id: string | null;
  type: LocationType | null;
  value?: number | null;
  icon_name?: string | null;
  image_path?: string | null;
  description?: string | null;
  created_at?: string;
};

export type ItemListRecord = {
  id: string;
  name: string;
  icon_name?: string | null;
  status?: ItemStatus | null;
  image_path?: string | null;
};

export type ItemRecord = {
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

export type ItemDocumentRecord = {
  id: string;
  item_id: string;
  title: string;
  document_type?: string | null;
  file_path: string;
  created_at?: string;
};

export type LinkedItemRecord = {
  id: string;
  name: string;
  location_id: string | null;
  status?: ItemStatus | null;
  icon_name?: string | null;
  image_path?: string | null;
};

export type ResourceLinkRecord = {
  id: string;
  entity_type: "item" | "location" | "template";
  entity_id: string;
  label: string;
  url: string;
  created_at?: string;
};

export type LocationDetailData = {
  location: LocationRecord | null;
  allLocations: LocationRecord[];
  childLocations: LocationRecord[];
  items: ItemListRecord[];
  assignedTags: Tag[];
  availableTags: Tag[];
  links: ResourceLinkRecord[];
};

export type ItemDetailData = {
  item: ItemRecord | null;
  locations: Array<{ id: string; name: string }>;
  assignedTags: Tag[];
  availableTags: Tag[];
  documents: ItemDocumentRecord[];
  linkedItems: LinkedItemRecord[];
  allItems: ItemRecord[];
  links: ResourceLinkRecord[];
};

export type DashboardData = {
  locations: LocationRecord[];
  items: ItemRecord[];
  templates: InventoryTemplateRecord[];
  topTags: TagUsageRecord[];
};

export type SearchResultRecord = {
  result_type: "location" | "item" | "tag";
  result_id: string;
  title: string;
  subtitle: string | null;
  meta: string | null;
  href: string;
  image_path?: string | null;
  icon_name?: string | null;
  item_status?: ItemStatus | null;
  location_type?: LocationType | null;
};

export type TagUsageRecord = {
  id: string;
  name: string;
  item_count: number;
  location_count: number;
};

export type InventoryTemplateRecord = {
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
  links?: Array<{ label: string; url: string }> | null;
  created_at?: string;
};

export type InventoryActivityRecord = {
  id: number;
  entity_type: string;
  entity_id?: string | null;
  action: "create" | "update" | "delete" | "move" | "attach" | "detach";
  title: string;
  description?: string | null;
  actor_label?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

export type TagDetailData = {
  tag: Tag | null;
  items: ItemRecord[];
  locations: LocationRecord[];
  usage: TagUsageRecord | null;
};

export type TagAssignmentData = {
  tag: Tag | null;
  items: ItemRecord[];
  locations: LocationRecord[];
  assignedItemIds: string[];
};

function normalizeItemRecord<T extends ItemRecord>(item: T): T {
  return {
    ...item,
    purchase_date: normalizeNullableDateValue(item.purchase_date),
  };
}

function normalizeTemplateRecord<T extends InventoryTemplateRecord>(template: T): T {
  return {
    ...template,
    item_purchase_date: normalizeNullableDateValue(template.item_purchase_date),
  };
}

export async function fetchLocationDetailData(locationId: string): Promise<LocationDetailData> {
  const [
    locationResponse,
    allLocationsResponse,
    childLocationsResponse,
    itemsResponse,
    locationTagsResponse,
    allTagsResponse,
    linksResponse,
  ] = await Promise.all([
    supabase.from<LocationRecord>("locations").select("*").eq("id", locationId).maybeSingle(),
    supabase.from<LocationRecord[]>("locations").select("*").order("name"),
    supabase.from<LocationRecord[]>("locations").select("*").eq("parent_id", locationId).order("name"),
    supabase
      .from<ItemListRecord[]>("items")
      .select("id, name, icon_name, status, image_path")
      .eq("location_id", locationId)
      .order("name"),
    supabase.from<Array<{ tag_id: string }>>("location_tags").select("tag_id").eq("location_id", locationId),
    supabase.from<Tag[]>("tags").select("id, name").order("name"),
    supabase
      .from<ResourceLinkRecord[]>("inventory_resource_links")
      .select("*")
      .eq("entity_type", "location")
      .eq("entity_id", locationId)
      .order("created_at", { ascending: false }),
  ]);

  if (locationResponse.error) {
    throw new Error(locationResponse.error.message);
  }

  const availableTags = (allTagsResponse.data ?? []) as Tag[];
  const tagIds = (locationTagsResponse.data ?? []).map((entry) => entry.tag_id as string);

  return {
    location: (locationResponse.data as LocationRecord | null) ?? null,
    allLocations: (allLocationsResponse.data ?? []) as LocationRecord[],
    childLocations: (childLocationsResponse.data ?? []) as LocationRecord[],
    items: (itemsResponse.data ?? []) as ItemListRecord[],
    assignedTags: availableTags.filter((tag) => tagIds.includes(tag.id)),
    availableTags,
    links: (linksResponse.data ?? []) as ResourceLinkRecord[],
  };
}

export async function fetchItemDetailData(itemId: string): Promise<ItemDetailData> {
  const [
    itemResponse,
    locationsResponse,
    itemTagsResponse,
    allTagsResponse,
    documentsResponse,
    linkedIdsResponse,
    allItemsResponse,
    linksResponse,
  ] = await Promise.all([
    supabase.from<ItemRecord>("items").select("*").eq("id", itemId).maybeSingle(),
    supabase.from<Array<{ id: string; name: string }>>("locations").select("id, name").order("name"),
    supabase.from<Array<{ tag_id: string }>>("item_tags").select("tag_id").eq("item_id", itemId),
    supabase.from<Tag[]>("tags").select("id, name").order("name"),
    supabase.from<ItemDocumentRecord[]>("item_documents").select("*").eq("item_id", itemId).order("created_at", { ascending: false }),
    supabase.from<Array<{ linked_item_id: string }>>("item_links").select("linked_item_id").eq("item_id", itemId),
    supabase.from<ItemRecord[]>("items").select("id, name, location_id, status, icon_name, image_path").order("name"),
    supabase
      .from<ResourceLinkRecord[]>("inventory_resource_links")
      .select("*")
      .eq("entity_type", "item")
      .eq("entity_id", itemId)
      .order("created_at", { ascending: false }),
  ]);

  if (itemResponse.error) {
    throw new Error(itemResponse.error.message);
  }

  const availableTags = (allTagsResponse.data ?? []) as Tag[];
  const tagIds = (itemTagsResponse.data ?? []).map((entry) => entry.tag_id as string);
  const allItems = ((allItemsResponse.data ?? []) as ItemRecord[]).map(normalizeItemRecord);
  const linkedItemIds = new Set((linkedIdsResponse.data ?? []).map((row) => row.linked_item_id as string));

  return {
    item: itemResponse.data ? normalizeItemRecord(itemResponse.data as ItemRecord) : null,
    locations: (locationsResponse.data ?? []) as Array<{ id: string; name: string }>,
    assignedTags: availableTags.filter((tag) => tagIds.includes(tag.id)),
    availableTags,
    documents: (documentsResponse.data ?? []) as ItemDocumentRecord[],
    linkedItems: allItems.filter((entry) => linkedItemIds.has(entry.id)) as LinkedItemRecord[],
    allItems,
    links: (linksResponse.data ?? []) as ResourceLinkRecord[],
  };
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const [locationsResponse, itemsResponse, templatesResponse, tagsResponse, itemTagsResponse, locationTagsResponse] = await Promise.all([
    supabase.from<LocationRecord[]>("locations").select("*").order("name"),
    supabase.from<ItemRecord[]>("items").select("*").order("name"),
    supabase.from<InventoryTemplateRecord[]>("inventory_templates").select("*").order("entity_type").order("name"),
    supabase.from<Tag[]>("tags").select("id, name").order("name"),
    supabase.from<Array<{ item_id: string; tag_id: string }>>("item_tags").select("item_id, tag_id"),
    supabase.from<Array<{ location_id: string; tag_id: string }>>("location_tags").select("location_id, tag_id"),
  ]);

  if (locationsResponse.error) {
    throw new Error(locationsResponse.error.message);
  }

  if (itemsResponse.error) {
    throw new Error(itemsResponse.error.message);
  }

  if (tagsResponse.error) {
    throw new Error(tagsResponse.error.message);
  }

  const tags = (tagsResponse.data ?? []) as Tag[];
  const itemTags = (itemTagsResponse.data ?? []) as Array<{ item_id: string; tag_id: string }>;
  const locationTags = (locationTagsResponse.data ?? []) as Array<{ location_id: string; tag_id: string }>;

  const topTags = tags
    .map((tag) => ({
      id: tag.id,
      name: tag.name,
      item_count: itemTags.filter((entry) => entry.tag_id === tag.id).length,
      location_count: locationTags.filter((entry) => entry.tag_id === tag.id).length,
    }))
    .filter((tag) => tag.item_count > 0 || tag.location_count > 0)
    .sort((a, b) => b.item_count + b.location_count - (a.item_count + a.location_count))
    .slice(0, 8);

  return {
    locations: (locationsResponse.data ?? []) as LocationRecord[],
    items: ((itemsResponse.data ?? []) as ItemRecord[]).map(normalizeItemRecord),
    templates: ((templatesResponse.data ?? []) as InventoryTemplateRecord[]).map(normalizeTemplateRecord),
    topTags,
  };
}

export async function fetchSearchResults(query: string): Promise<SearchResultRecord[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }
  const tokens = normalizedQuery
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const phrase = normalizedQuery.toLowerCase();

  const [locationsResponse, itemsResponse, tagsResponse, itemTagsResponse] = await Promise.all([
    supabase.from<LocationRecord[]>("locations").select("*").order("name"),
    supabase.from<ItemRecord[]>("items").select("*").order("name"),
    supabase.from<Tag[]>("tags").select("id, name").order("name"),
    supabase.from<Array<{ item_id: string; tag_id: string }>>("item_tags").select("item_id, tag_id"),
  ]);

  if (locationsResponse.error) {
    throw new Error(locationsResponse.error.message);
  }

  if (itemsResponse.error) {
    throw new Error(itemsResponse.error.message);
  }

  if (tagsResponse.error) {
    throw new Error(tagsResponse.error.message);
  }

  if (itemTagsResponse.error) {
    throw new Error(itemTagsResponse.error.message);
  }

  const locations = (locationsResponse.data ?? []) as LocationRecord[];
  const items = ((itemsResponse.data ?? []) as ItemRecord[]).map(normalizeItemRecord);
  const tags = (tagsResponse.data ?? []) as Tag[];
  const itemTags = (itemTagsResponse.data ?? []) as Array<{ item_id: string; tag_id: string }>;

  const locationNames = new Map(locations.map((location) => [location.id, location.name]));
  const tagsById = new Map(tags.map((tag) => [tag.id, tag.name]));
  const itemTagNames = new Map<string, string[]>();

  for (const entry of itemTags) {
    const tagName = tagsById.get(entry.tag_id);

    if (!tagName) {
      continue;
    }

    itemTagNames.set(entry.item_id, [...(itemTagNames.get(entry.item_id) ?? []), tagName]);
  }

  function normalizeValues(values: Array<string | null | undefined>) {
    return values
      .map((value) => value?.toLowerCase().trim() ?? "")
      .filter(Boolean);
  }

  function matchesPhrase(values: Array<string | null | undefined>) {
    return normalizeValues(values).some((value) => value.includes(phrase));
  }

  function matchesAllTokens(values: Array<string | null | undefined>) {
    const normalizedValues = normalizeValues(values);
    return tokens.every((token) => normalizedValues.some((value) => value.includes(token)));
  }

  function matchesAssignedTags(tagNames: string[]) {
    const normalizedTags = normalizeValues(tagNames);
    return normalizedTags.length > 0 && tokens.every((token) => normalizedTags.some((name) => name.includes(token)));
  }

  function scoreMatch(values: Array<string | null | undefined>, tagNames: string[] = []) {
    let score = 0;

    if (matchesPhrase(values)) {
      score += 4;
    }

    if (matchesAllTokens(values)) {
      score += 3;
    }

    if (matchesAssignedTags(tagNames)) {
      score += 3;
    }

    return score;
  }

  const locationResults = locations
    .map((location) => {
      const score = scoreMatch([
        location.name,
        location.description,
        getLocationTypeLabel(location.type),
      ]);

      return score > 0
        ? ({
            result_type: "location",
            result_id: location.id,
            title: location.name,
            subtitle: getLocationTypeLabel(location.type),
            meta: location.description ?? null,
            href: `/locations/${location.id}`,
            image_path: location.image_path ?? null,
            icon_name: location.icon_name ?? null,
            location_type: location.type ?? null,
            score,
          } satisfies SearchResultRecord & { score: number })
        : null;
    })
    .filter(Boolean) as Array<SearchResultRecord & { score: number }>;

  const itemResults = items
    .map((item) => {
      const tagNames = itemTagNames.get(item.id) ?? [];
      const score = scoreMatch(
        [
          item.name,
          item.description,
          getItemStatusLabel(item.status),
          locationNames.get(item.location_id ?? "") ?? "",
          tagNames.join(" "),
        ],
        tagNames,
      );

      return score > 0
        ? ({
            result_type: "item",
            result_id: item.id,
            title: item.name,
            subtitle: locationNames.get(item.location_id ?? "") ?? "Keine Location",
            meta: item.description ?? (tagNames.length > 0 ? `Tags: ${tagNames.join(", ")}` : null),
            href: `/items/${item.id}`,
            image_path: item.image_path ?? null,
            icon_name: item.icon_name ?? null,
            item_status: item.status ?? null,
            score,
          } satisfies SearchResultRecord & { score: number })
        : null;
    })
    .filter(Boolean) as Array<SearchResultRecord & { score: number }>;

  const tagResults = tags
    .map((tag) => {
      const score = scoreMatch([tag.name]);

      return score > 0
        ? ({
            result_type: "tag",
            result_id: tag.id,
            title: tag.name,
            subtitle: "Tag",
            meta: "Oeffnet die Tag-Details und alle verknuepften Items.",
            href: `/tags/${tag.id}`,
            score,
          } satisfies SearchResultRecord & { score: number })
        : null;
    })
    .filter(Boolean) as Array<SearchResultRecord & { score: number }>;

  return [...itemResults, ...locationResults, ...tagResults]
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.title.localeCompare(b.title, "de");
    })
    .map(({ score, ...result }) => {
      void score;
      return result;
    });
}

export async function fetchTagsOverview(): Promise<TagUsageRecord[]> {
  const [tagsResponse, itemTagsResponse, locationTagsResponse] = await Promise.all([
    supabase.from<Tag[]>("tags").select("id, name").order("name"),
    supabase.from<Array<{ item_id: string; tag_id: string }>>("item_tags").select("item_id, tag_id"),
    supabase.from<Array<{ location_id: string; tag_id: string }>>("location_tags").select("location_id, tag_id"),
  ]);

  if (tagsResponse.error) {
    throw new Error(tagsResponse.error.message);
  }

  const tags = (tagsResponse.data ?? []) as Tag[];
  const itemTags = (itemTagsResponse.data ?? []) as Array<{ item_id: string; tag_id: string }>;
  const locationTags = (locationTagsResponse.data ?? []) as Array<{ location_id: string; tag_id: string }>;

  return tags
    .map((tag) => ({
      id: tag.id,
      name: tag.name,
      item_count: itemTags.filter((entry) => entry.tag_id === tag.id).length,
      location_count: locationTags.filter((entry) => entry.tag_id === tag.id).length,
    }))
    .sort((a, b) => {
      const usageDiff = b.item_count + b.location_count - (a.item_count + a.location_count);
      return usageDiff !== 0 ? usageDiff : a.name.localeCompare(b.name);
    });
}

export async function fetchTagDetailData(tagId: string): Promise<TagDetailData> {
  const [tagResponse, itemTagsResponse, locationTagsResponse, itemsResponse, locationsResponse] =
    await Promise.all([
      supabase.from<Tag>("tags").select("id, name").eq("id", tagId).maybeSingle(),
      supabase.from<Array<{ item_id: string }>>("item_tags").select("item_id").eq("tag_id", tagId),
      supabase.from<Array<{ location_id: string }>>("location_tags").select("location_id").eq("tag_id", tagId),
      supabase.from<ItemRecord[]>("items").select("*").order("name"),
      supabase.from<LocationRecord[]>("locations").select("*").order("name"),
    ]);

  if (tagResponse.error) {
    throw new Error(tagResponse.error.message);
  }

  const tag = (tagResponse.data as Tag | null) ?? null;
  const allItems = (itemsResponse.data ?? []) as ItemRecord[];
  const allLocations = (locationsResponse.data ?? []) as LocationRecord[];
  const itemIds = new Set((itemTagsResponse.data ?? []).map((entry) => entry.item_id as string));
  const locationIds = new Set(
    (locationTagsResponse.data ?? []).map((entry) => entry.location_id as string)
  );

  return {
    tag,
    items: allItems.map(normalizeItemRecord).filter((item) => itemIds.has(item.id)),
    locations: allLocations.filter((location) => locationIds.has(location.id)),
    usage: tag
      ? {
          id: tag.id,
          name: tag.name,
          item_count: itemIds.size,
          location_count: locationIds.size,
        }
      : null,
  };
}

export async function fetchTagAssignmentData(tagId: string): Promise<TagAssignmentData> {
  const [tagResponse, itemTagsResponse, itemsResponse, locationsResponse] = await Promise.all([
    supabase.from<Tag>("tags").select("id, name").eq("id", tagId).maybeSingle(),
    supabase.from<Array<{ item_id: string }>>("item_tags").select("item_id").eq("tag_id", tagId),
    supabase.from<ItemRecord[]>("items").select("*").order("name"),
    supabase.from<LocationRecord[]>("locations").select("*").order("name"),
  ]);

  if (tagResponse.error) {
    throw new Error(tagResponse.error.message);
  }

  if (itemsResponse.error) {
    throw new Error(itemsResponse.error.message);
  }

  if (locationsResponse.error) {
    throw new Error(locationsResponse.error.message);
  }

  return {
    tag: (tagResponse.data as Tag | null) ?? null,
    items: ((itemsResponse.data ?? []) as ItemRecord[]).map(normalizeItemRecord),
    locations: (locationsResponse.data ?? []) as LocationRecord[],
    assignedItemIds: (itemTagsResponse.data ?? []).map((entry) => entry.item_id as string),
  };
}

export async function fetchTemplatesOverview(): Promise<InventoryTemplateRecord[]> {
  const { data, error } = await supabase
    .from<InventoryTemplateRecord[]>("inventory_templates")
    .select("*")
    .order("entity_type")
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as InventoryTemplateRecord[]).map(normalizeTemplateRecord);
}

export async function fetchInventoryActivity(limit = 200): Promise<InventoryActivityRecord[]> {
  const { data, error } = await supabase
    .from<InventoryActivityRecord[]>("inventory_activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.message.includes("inventory_activity_log")) {
      return [];
    }

    throw new Error(error.message);
  }

  return (data ?? []) as InventoryActivityRecord[];
}
