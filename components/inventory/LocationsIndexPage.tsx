"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FloatingCreateButton } from "@/components/inventory/FloatingCreateButton";
import { InventoryImage } from "@/components/inventory/InventoryImage";
import {
  InventoryIconBadge,
  LocationTypeIcon,
  getMaterialIconLabel,
} from "@/components/inventory/InventoryIcon";
import { Input } from "@/components/ui/Input";
import { getLocationTypeLabel } from "@/lib/inventory";
import type { ItemRecord, LocationRecord } from "@/lib/inventory-data";

type TreeNode = LocationRecord & { children: TreeNode[] };

function buildLocationTree(locations: LocationRecord[]) {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  locations.forEach((location) => {
    map.set(location.id, { ...location, children: [] });
  });

  locations.forEach((location) => {
    const current = map.get(location.id);

    if (!current) {
      return;
    }

    if (location.parent_id && map.has(location.parent_id)) {
      map.get(location.parent_id)?.children.push(current);
    } else {
      roots.push(current);
    }
  });

  return roots;
}

export function LocationsIndexPage({
  initialItems,
  initialLocations,
  initialQuery = "",
}: {
  initialItems: ItemRecord[];
  initialLocations: LocationRecord[];
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);

  const filteredLocations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return initialLocations;
    }

    return initialLocations.filter((location) => {
      return (
        location.name.toLowerCase().includes(normalizedQuery) ||
        getLocationTypeLabel(location.type).toLowerCase().includes(normalizedQuery) ||
        (location.description ?? "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [initialLocations, query]);

  const itemCounts = useMemo(() => {
    const childrenByParent = new Map<string | null, string[]>();

    initialLocations.forEach((location) => {
      const current = childrenByParent.get(location.parent_id) ?? [];
      current.push(location.id);
      childrenByParent.set(location.parent_id, current);
    });

    const directItemsByLocation = new Map<string, number>();
    initialItems.forEach((item) => {
      if (!item.location_id) {
        return;
      }

      directItemsByLocation.set(item.location_id, (directItemsByLocation.get(item.location_id) ?? 0) + 1);
    });

    const totals = new Map<string, number>();

    function countRecursive(locationId: string): number {
      if (totals.has(locationId)) {
        return totals.get(locationId) ?? 0;
      }

      const direct = directItemsByLocation.get(locationId) ?? 0;
      const children = childrenByParent.get(locationId) ?? [];
      const nested = children.reduce((sum, childId) => sum + countRecursive(childId), 0);
      const total = direct + nested;

      totals.set(locationId, total);
      return total;
    }

    initialLocations.forEach((location) => {
      countRecursive(location.id);
    });

    return totals;
  }, [initialItems, initialLocations]);

  const tree = useMemo(() => buildLocationTree(filteredLocations), [filteredLocations]);

  return (
    <div className="min-h-screen bg-gray-100 px-3 py-4 text-gray-800 dark:bg-gray-950 dark:text-gray-100 sm:px-4 lg:px-6">
      <div className="mx-auto max-w-6xl space-y-4 lg:space-y-6">
        <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-end sm:justify-between dark:border-gray-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
              Zugriff
            </p>
            <h1 className="text-3xl font-semibold">Alle Locations</h1>
          </div>
          <div className="inline-flex rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            {filteredLocations.length} sichtbar
          </div>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:p-5">
          <label className="mb-2 block text-sm font-medium text-gray-600 dark:text-gray-300">
            Locations durchsuchen
          </label>
          <Input
            placeholder="Name, Typ oder Beschreibung"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:p-5">
          <p className="mb-4 text-sm font-medium text-gray-600 dark:text-gray-300">
            Hierarchie
          </p>
          <div className="space-y-2">
            {tree.map((location) => (
              <LocationHierarchyNode
                key={location.id}
                itemCounts={itemCounts}
                location={location}
              />
            ))}
          </div>
        </section>
      </div>
      <FloatingCreateButton ariaLabel="Neue Location anlegen" href="/" createType="location" />
    </div>
  );
}

function LocationHierarchyNode({
  itemCounts,
  location,
}: {
  itemCounts: Map<string, number>;
  location: TreeNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <Link
        href={`/locations/${location.id}`}
        className="block rounded-2xl px-4 py-4 transition hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-3">
            <InventoryImage
              alt={location.name}
              imagePath={location.image_path}
              className="h-14 w-14 rounded-2xl object-cover"
              fallback={
                <InventoryIconBadge className="h-14 w-14 rounded-2xl bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300">
                  <LocationTypeIcon type={location.type} iconName={location.icon_name} className="h-5 w-5" />
                </InventoryIconBadge>
              }
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                {getLocationTypeLabel(location.type)}
              </p>
              <h2 className="mt-1 text-base font-semibold">{location.name}</h2>
              <p className="mt-1 text-xs text-gray-400">{itemCounts.get(location.id) ?? 0} Items</p>
              {location.icon_name ? (
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  Icon: {getMaterialIconLabel(location.icon_name)}
                </p>
              ) : null}
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {location.description?.trim() ? location.description : "Keine Beschreibung"}
              </p>
            </div>
          </div>
        </div>
      </Link>

      {location.children.length > 0 ? (
        <div className="mt-2 space-y-2 rounded-xl border border-dashed border-gray-200 bg-gray-50/70 p-3 dark:border-gray-700 dark:bg-gray-800/30">
          {location.children.map((child) => (
            <LocationHierarchyNode
              key={child.id}
              itemCounts={itemCounts}
              location={child}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
