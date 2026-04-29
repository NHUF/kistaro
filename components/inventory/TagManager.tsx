"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { logInventoryActivity } from "@/lib/inventory-activity";
import { supabase } from "@/lib/supabase";
import type { Tag } from "@/lib/inventory";

type TagManagerProps = {
  entityId: string;
  entityType: "item" | "location";
  assignedTags: Tag[];
  availableTags: Tag[];
  onChange: () => Promise<void>;
};

export function TagManager({
  entityId,
  entityType,
  assignedTags,
  availableTags,
  onChange,
}: TagManagerProps) {
  const [newTagName, setNewTagName] = useState("");
  const [busy, setBusy] = useState(false);

  async function attachTag(tagName: string) {
    const trimmedName = tagName.trim();

    if (!trimmedName) {
      return;
    }

    setBusy(true);

    const rpcName = entityType === "item" ? "attach_item_tag" : "attach_location_tag";
    const args =
      entityType === "item"
        ? { target_item_id: entityId, tag_name: trimmedName }
        : { target_location_id: entityId, tag_name: trimmedName };

    const { error } = await supabase.rpc(rpcName, args);

    setBusy(false);

    if (error) {
      window.alert(error.message);
      return;
    }

    await logInventoryActivity({
      action: "attach",
      entityId,
      entityType: entityType === "item" ? "item-tag" : "location-tag",
      title: `Tag verknüpft: ${trimmedName}`,
      description: `${entityType === "item" ? "Item" : "Location"} wurde mit einem Tag verknüpft.`,
      metadata: {
        entity_id: entityId,
        entity_type: entityType,
        tag_name: trimmedName,
      },
    });

    setNewTagName("");
    await onChange();
  }

  async function detachTag(tagId: string) {
    setBusy(true);

    const rpcName = entityType === "item" ? "detach_item_tag" : "detach_location_tag";
    const args =
      entityType === "item"
        ? { target_item_id: entityId, target_tag_id: tagId }
        : { target_location_id: entityId, target_tag_id: tagId };

    const { error } = await supabase.rpc(rpcName, args);

    setBusy(false);

    if (error) {
      window.alert(error.message);
      return;
    }

    const removedTag = assignedTags.find((tag) => tag.id === tagId);

    await logInventoryActivity({
      action: "detach",
      entityId,
      entityType: entityType === "item" ? "item-tag" : "location-tag",
      title: `Tag entfernt: ${removedTag?.name ?? "Tag"}`,
      description: `${entityType === "item" ? "Item" : "Location"} wurde von einem Tag gelöst.`,
      metadata: {
        entity_id: entityId,
        entity_type: entityType,
        tag_id: tagId,
      },
    });

    await onChange();
  }

  const availableSuggestions = availableTags.filter(
    (tag) => !assignedTags.some((assignedTag) => assignedTag.id === tag.id)
  );

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-900">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Tags</p>
        <h3 className="text-lg font-semibold">Zuordnung</h3>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Neuen Tag eingeben"
          value={newTagName}
          onChange={(event) => setNewTagName(event.target.value)}
        />
        <Button variant="primary" onClick={() => void attachTag(newTagName)} disabled={busy}>
          Hinzufügen
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {assignedTags.length > 0 ? (
          assignedTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => void detachTag(tag.id)}
              className="rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-600 transition hover:border-red-300 hover:text-red-600 dark:border-gray-700 dark:text-gray-300"
            >
              {tag.name} x
            </button>
          ))
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">Noch keine Tags zugeordnet.</p>
        )}
      </div>

      {availableSuggestions.length > 0 ? (
        <div className="mt-5">
          <p className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">
            Vorhandene Tags
          </p>
          <div className="flex flex-wrap gap-2">
            {availableSuggestions.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => void attachTag(tag.name)}
                className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
