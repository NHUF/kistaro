"use client";

import { useState } from "react";
import Link from "next/link";
import { InventoryImage } from "@/components/inventory/InventoryImage";
import { InventoryIconBadge, ItemStatusIcon } from "@/components/inventory/InventoryIcon";
import { Button } from "@/components/ui/Button";
import { logInventoryActivity } from "@/lib/inventory-activity";
import { supabase } from "@/lib/supabase";
import type { ItemRecord, LinkedItemRecord } from "@/lib/inventory-data";

export function RelatedItemsManager({
  currentItem,
  linkedItems,
  locations,
  onChange,
  selectableItems,
}: {
  currentItem: ItemRecord;
  linkedItems: LinkedItemRecord[];
  locations: Array<{ id: string; name: string }>;
  onChange: () => Promise<void>;
  selectableItems: ItemRecord[];
}) {
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [busy, setBusy] = useState(false);

  const availableTargets = selectableItems.filter(
    (entry) => entry.id !== currentItem.id && !linkedItems.some((linked) => linked.id === entry.id)
  );

  function getLocationName(locationId: string | null) {
    if (!locationId) {
      return "Keine Location";
    }

    return locations.find((entry) => entry.id === locationId)?.name ?? "Unbekannt";
  }

  async function attachLink() {
    if (!selectedTargetId) {
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.rpc("attach_item_link", {
        source_item_id: currentItem.id,
        target_item_id: selectedTargetId,
      });

      if (error) {
        window.alert(error.message);
        return;
      }

      const targetItem = selectableItems.find((entry) => entry.id === selectedTargetId);

      await logInventoryActivity({
        action: "attach",
        entityId: currentItem.id,
        entityType: "item-link",
        title: `Items verknüpft: ${currentItem.name}`,
        description: targetItem
          ? `${currentItem.name} wurde mit ${targetItem.name} verknüpft.`
          : "Zwei Items wurden miteinander verknüpft.",
        metadata: {
          item_id: currentItem.id,
          linked_item_id: selectedTargetId,
        },
      });

      setSelectedTargetId("");
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  async function detachLink(targetItemId: string) {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("detach_item_link", {
        source_item_id: currentItem.id,
        target_item_id: targetItemId,
      });

      if (error) {
        window.alert(error.message);
        return;
      }

      const targetItem = linkedItems.find((entry) => entry.id === targetItemId);

      await logInventoryActivity({
        action: "detach",
        entityId: currentItem.id,
        entityType: "item-link",
        title: `Verknüpfung gelöst: ${currentItem.name}`,
        description: targetItem
          ? `${currentItem.name} wurde von ${targetItem.name} getrennt.`
          : "Eine Item-Verknüpfung wurde gelöst.",
        metadata: {
          item_id: currentItem.id,
          linked_item_id: targetItemId,
        },
      });

      await onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm dark:bg-gray-900">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Verknüpfte Items</p>
          <h2 className="mt-2 text-xl font-semibold">Gehört zusammen</h2>
        </div>
        <div className="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-300">
          {linkedItems.length} Verknüpfung{linkedItems.length === 1 ? "" : "en"}
        </div>
      </div>

      <div className="mt-4 flex gap-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
        <select
          value={selectedTargetId}
          onChange={(event) => setSelectedTargetId(event.target.value)}
          className="w-full rounded-md border bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-700"
        >
          <option value="">Item zum Verknüpfen wählen</option>
          {availableTargets.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
        <Button variant="primary" onClick={() => void attachLink()} disabled={busy || !selectedTargetId}>
          Verknüpfen
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {linkedItems.length > 0 ? (
          linkedItems.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start justify-between gap-4 rounded-2xl bg-gray-50 px-4 py-4 dark:bg-gray-800"
            >
              <Link href={`/items/${entry.id}`} className="flex items-start gap-3">
                <InventoryImage
                  alt={entry.name}
                  imagePath={entry.image_path}
                  className="h-12 w-12 rounded-2xl object-cover"
                  fallback={
                    <InventoryIconBadge className="h-12 w-12 rounded-2xl bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300">
                      <ItemStatusIcon status={entry.status} iconName={entry.icon_name} className="h-5 w-5" />
                    </InventoryIconBadge>
                  }
                />
                <div>
                  <p className="font-medium">{entry.name}</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {getLocationName(entry.location_id)}
                  </p>
                </div>
              </Link>
              <Button variant="danger" onClick={() => void detachLink(entry.id)} disabled={busy}>
                Entfernen
              </Button>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Noch keine verknüpften Items vorhanden.
          </p>
        )}
      </div>
    </section>
  );
}
