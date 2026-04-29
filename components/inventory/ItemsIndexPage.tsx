"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FloatingCreateButton } from "@/components/inventory/FloatingCreateButton";
import { InventoryImage } from "@/components/inventory/InventoryImage";
import {
  InventoryIconBadge,
  ItemStatusIcon,
  getMaterialIconLabel,
} from "@/components/inventory/InventoryIcon";
import { Input } from "@/components/ui/Input";
import { getItemStatusLabel } from "@/lib/inventory";
import type { ItemRecord, LocationRecord } from "@/lib/inventory-data";

export function ItemsIndexPage({
  initialItems,
  locations,
  initialQuery = "",
}: {
  initialItems: ItemRecord[];
  locations: LocationRecord[];
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return initialItems;
    }

    return initialItems.filter((item) => {
      const locationName =
        locations.find((location) => location.id === item.location_id)?.name.toLowerCase() ?? "";

      return (
        item.name.toLowerCase().includes(normalizedQuery) ||
        (item.description ?? "").toLowerCase().includes(normalizedQuery) ||
        getItemStatusLabel(item.status).toLowerCase().includes(normalizedQuery) ||
        locationName.includes(normalizedQuery)
      );
    });
  }, [initialItems, locations, query]);

  return (
    <div className="min-h-screen bg-gray-100 px-3 py-4 text-gray-800 dark:bg-gray-950 dark:text-gray-100 sm:px-4 lg:px-6">
      <div className="mx-auto max-w-6xl space-y-4 lg:space-y-6">
        <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-end sm:justify-between dark:border-gray-800">
          <div>
            <Link href="/" className="text-sm text-blue-600 dark:text-blue-400">
              Zurück zum Dashboard
            </Link>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
              Zugriff
            </p>
            <h1 className="text-3xl font-semibold">Alle Items</h1>
          </div>
          <div className="inline-flex rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            {filteredItems.length} sichtbar
          </div>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:p-5">
          <label className="mb-2 block text-sm font-medium text-gray-600 dark:text-gray-300">
            Items durchsuchen
          </label>
          <Input
            placeholder="Name, Status, Beschreibung oder Location"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </section>

        <section className="grid gap-3 xl:grid-cols-2">
          {filteredItems.map((item) => {
            const locationName =
              locations.find((location) => location.id === item.location_id)?.name ?? "Keine Location";

            return (
              <Link
                key={item.id}
                href={`/items/${item.id}`}
                className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
              >
                <div className="flex items-start gap-3">
                  <InventoryImage
                    alt={item.name}
                    imagePath={item.image_path}
                    className="h-14 w-14 rounded-2xl object-cover"
                    fallback={
                      <InventoryIconBadge className="h-14 w-14 rounded-2xl bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300">
                        <ItemStatusIcon status={item.status} iconName={item.icon_name} className="h-5 w-5" />
                      </InventoryIconBadge>
                    }
                  />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                      {getItemStatusLabel(item.status)}
                    </p>
                    <h2 className="mt-2 text-lg font-semibold">{item.name}</h2>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{locationName}</p>
                    {item.icon_name ? (
                      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        Icon: {getMaterialIconLabel(item.icon_name)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      </div>
      <FloatingCreateButton ariaLabel="Neues Item anlegen" href="/" createType="item" />
    </div>
  );
}
