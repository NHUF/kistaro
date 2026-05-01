"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { InventoryIconBadge, ItemStatusIcon } from "@/components/inventory/InventoryIcon";
import { InventoryImage } from "@/components/inventory/InventoryImage";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { getItemStatusLabel } from "@/lib/inventory";
import { logInventoryActivity } from "@/lib/inventory-activity";
import type { ItemRecord, LocationRecord, TagAssignmentData } from "@/lib/inventory-data";
import { supabase } from "@/lib/supabase";

type LocationOption = {
  id: string;
  label: string;
};

function buildLocationOptions(locations: LocationRecord[]) {
  const childrenByParent = new Map<string | null, LocationRecord[]>();

  for (const location of locations) {
    const key = location.parent_id ?? null;
    childrenByParent.set(key, [...(childrenByParent.get(key) ?? []), location]);
  }

  const options: LocationOption[] = [];

  function walk(parentId: string | null, depth: number) {
    const children = [...(childrenByParent.get(parentId) ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    for (const child of children) {
      options.push({
        id: child.id,
        label: `${"— ".repeat(depth)}${child.name}`,
      });
      walk(child.id, depth + 1);
    }
  }

  walk(null, 0);

  return options;
}

function createLocationHelpers(locations: LocationRecord[]) {
  const byId = new Map(locations.map((location) => [location.id, location]));
  const childrenByParent = new Map<string | null, LocationRecord[]>();

  for (const location of locations) {
    const key = location.parent_id ?? null;
    childrenByParent.set(key, [...(childrenByParent.get(key) ?? []), location]);
  }

  function collectDescendants(locationId: string) {
    const result = new Set<string>([locationId]);
    const stack = [...(childrenByParent.get(locationId) ?? [])];

    while (stack.length > 0) {
      const next = stack.pop();

      if (!next || result.has(next.id)) {
        continue;
      }

      result.add(next.id);
      stack.push(...(childrenByParent.get(next.id) ?? []));
    }

    return result;
  }

  function getPath(locationId: string | null | undefined) {
    if (!locationId) {
      return "Keine Location";
    }

    const parts: string[] = [];
    let current = byId.get(locationId);
    const seen = new Set<string>();

    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      parts.unshift(current.name);
      current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }

    return parts.length > 0 ? parts.join(" / ") : "Unbekannte Location";
  }

  return { collectDescendants, getPath };
}

function matchesQuery(item: ItemRecord, locationPath: string, query: string) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [
    item.name,
    item.description ?? "",
    getItemStatusLabel(item.status),
    locationPath,
  ].some((value) => value.toLowerCase().includes(normalized));
}

export function TagAssignPage({
  initialData,
  tagId,
}: {
  initialData: TagAssignmentData;
  tagId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [includeDescendants, setIncludeDescendants] = useState(true);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>(initialData.assignedItemIds);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const locationOptions = useMemo(
    () => buildLocationOptions(initialData.locations),
    [initialData.locations]
  );

  const locationHelpers = useMemo(
    () => createLocationHelpers(initialData.locations),
    [initialData.locations]
  );

  const allowedLocationIds = useMemo(() => {
    if (!selectedLocationId) {
      return null;
    }

    return includeDescendants
      ? locationHelpers.collectDescendants(selectedLocationId)
      : new Set([selectedLocationId]);
  }, [includeDescendants, locationHelpers, selectedLocationId]);

  const visibleItems = useMemo(() => {
    return initialData.items.filter((item) => {
      const locationPath = locationHelpers.getPath(item.location_id);
      const locationMatches =
        !allowedLocationIds ||
        (item.location_id ? allowedLocationIds.has(item.location_id) : false);

      return locationMatches && matchesQuery(item, locationPath, query);
    });
  }, [allowedLocationIds, initialData.items, locationHelpers, query]);

  const selectedSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);

  if (!initialData.tag) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 text-gray-800 dark:bg-gray-950 dark:text-gray-100">
        <p className="text-sm text-gray-500 dark:text-gray-400">Tag nicht gefunden.</p>
        <Link href="/tags" className="mt-4 inline-block text-sm text-blue-600 dark:text-blue-400">
          Zurück zu allen Tags
        </Link>
      </div>
    );
  }

  const tag = initialData.tag;

  function toggleItem(itemId: string) {
    setSelectedItemIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]
    );
  }

  function selectVisibleItems() {
    setSelectedItemIds((current) => Array.from(new Set([...current, ...visibleItems.map((item) => item.id)])));
  }

  function deselectVisibleItems() {
    const visibleIds = new Set(visibleItems.map((item) => item.id));
    setSelectedItemIds((current) => current.filter((id) => !visibleIds.has(id)));
  }

  async function saveAssignments() {
    setSubmitting(true);
    setStatusMessage(null);

    try {
      const deleteResponse = await supabase.from("item_tags").delete().eq("tag_id", tagId);

      if (deleteResponse.error) {
        window.alert(deleteResponse.error.message);
        return;
      }

      if (selectedItemIds.length > 0) {
        const insertResponse = await supabase.from("item_tags").insert(
          selectedItemIds.map((itemId) => ({
            item_id: itemId,
            tag_id: tagId,
          }))
        );

        if (insertResponse.error) {
          window.alert(insertResponse.error.message);
          return;
        }
      }

      await logInventoryActivity({
        action: "update",
        entityId: tagId,
        entityType: "tag",
        title: `Tag-Zuweisung aktualisiert: ${tag.name}`,
        description: `${selectedItemIds.length} Items sind diesem Tag zugeordnet.`,
        metadata: {
          item_count: selectedItemIds.length,
        },
      });

      setStatusMessage("Zuweisung gespeichert.");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 px-3 py-4 text-gray-800 dark:bg-gray-950 dark:text-gray-100 sm:px-4 lg:px-6">
      <div className="mx-auto max-w-6xl space-y-4 lg:space-y-6">
        <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 dark:border-gray-800 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link href={`/tags/${tagId}`} className="text-sm text-blue-600 dark:text-blue-400">
              Zurück zum Tag
            </Link>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
              Tag zuweisen
            </p>
            <h1 className="text-3xl font-semibold">{tag.name}</h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Wähle alle Items aus, die diesen Tag bekommen sollen.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
              {selectedItemIds.length} ausgewählt
            </span>
            <Button variant="success" onClick={() => void saveAssignments()} disabled={submitting}>
              {submitting ? "Speichert..." : "Zuweisung speichern"}
            </Button>
          </div>
        </div>

        <section className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-600 dark:text-gray-300">
              Items durchsuchen
            </label>
            <Input
              placeholder="Name, Beschreibung, Status oder Location"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-600 dark:text-gray-300">
                Struktur-Fokus
              </label>
              <Select
                value={selectedLocationId}
                onChange={(event) => setSelectedLocationId(event.target.value)}
              >
                <option value="">Alle Locations</option>
                {locationOptions.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-600 dark:text-gray-300">
                Fokus-Tiefe
              </label>
              <Select
                disabled={!selectedLocationId}
                value={includeDescendants ? "descendants" : "direct"}
                onChange={(event) => setIncludeDescendants(event.target.value === "descendants")}
              >
                <option value="descendants">Location und Unter-Locations</option>
                <option value="direct">Nur direkte Location</option>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button variant="ghost" onClick={selectVisibleItems} disabled={visibleItems.length === 0}>
              Sichtbare auswählen
            </Button>
            <Button variant="ghost" onClick={deselectVisibleItems} disabled={visibleItems.length === 0}>
              Sichtbare abwählen
            </Button>
          </div>
        </section>

        {statusMessage ? (
          <p className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
            {statusMessage}
          </p>
        ) : null}

        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-col gap-1 border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {visibleItems.length} Items sichtbar
            </p>
            <p className="text-xs text-gray-400">
              Struktur zeigt bei „Location und Unter-Locations“ alle Items im gesamten Zweig.
            </p>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {visibleItems.length > 0 ? (
              visibleItems.map((item) => {
                const locationPath = locationHelpers.getPath(item.location_id);

                return (
                  <label
                    key={item.id}
                    className="flex cursor-pointer gap-3 px-4 py-3 transition hover:bg-gray-50 dark:hover:bg-gray-800/70"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSet.has(item.id)}
                      onChange={() => toggleItem(item.id)}
                      className="mt-4 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <InventoryImage
                      alt={item.name}
                      imagePath={item.image_path}
                      className="h-12 w-12 rounded-2xl object-cover"
                      fallback={
                        <InventoryIconBadge className="h-12 w-12 rounded-2xl">
                          <ItemStatusIcon status={item.status} iconName={item.icon_name} />
                        </InventoryIconBadge>
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-gray-900 dark:text-gray-50">{item.name}</p>
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                          {getItemStatusLabel(item.status)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
                        {locationPath}
                      </p>
                      {item.description ? (
                        <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-gray-600 dark:text-gray-300">
                          {item.description}
                        </p>
                      ) : null}
                    </div>
                  </label>
                );
              })
            ) : (
              <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
                Keine Items passen zu Suche und Struktur-Fokus.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
