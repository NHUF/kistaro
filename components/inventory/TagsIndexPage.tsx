"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FloatingCreateButton } from "@/components/inventory/FloatingCreateButton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { logInventoryActivity } from "@/lib/inventory-activity";
import type { TagUsageRecord } from "@/lib/inventory-data";
import { supabase } from "@/lib/supabase";

export function TagsIndexPage({
  initialQuery = "",
  tags,
}: {
  initialQuery?: string;
  tags: TagUsageRecord[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [editTag, setEditTag] = useState<TagUsageRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteTag, setDeleteTag] = useState<TagUsageRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filteredTags = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return tags;
    }

    return tags.filter((tag) => tag.name.toLowerCase().includes(normalized));
  }, [query, tags]);

  async function createTag() {
    const nextName = createName.trim();

    if (!nextName) {
      window.alert("Bitte einen Tag-Namen eingeben.");
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.from("tags").insert({ name: nextName });

      if (error) {
        window.alert(error.message);
        return;
      }

      await logInventoryActivity({
        action: "create",
        entityType: "tag",
        title: `Tag erstellt: ${nextName}`,
        description: "Neuer Tag wurde angelegt.",
      });

      setCreateOpen(false);
      setCreateName("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function updateTag() {
    if (!editTag) {
      return;
    }

    const nextName = editName.trim();

    if (!nextName) {
      window.alert("Bitte einen Tag-Namen eingeben.");
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.from("tags").update({ name: nextName }).eq("id", editTag.id);

      if (error) {
        window.alert(error.message);
        return;
      }

      await logInventoryActivity({
        action: "update",
        entityId: editTag.id,
        entityType: "tag",
        title: `Tag bearbeitet: ${nextName}`,
        description: `Tag wurde von "${editTag.name}" auf "${nextName}" umbenannt.`,
      });

      setEditTag(null);
      setEditName("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function removeTag() {
    if (!deleteTag) {
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.from("tags").delete().eq("id", deleteTag.id);

      if (error) {
        window.alert(error.message);
        return;
      }

      await logInventoryActivity({
        action: "delete",
        entityId: deleteTag.id,
        entityType: "tag",
        title: `Tag gelöscht: ${deleteTag.name}`,
        description: "Tag und alle Zuordnungen wurden entfernt.",
      });

      setDeleteTag(null);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 px-3 py-4 text-gray-800 dark:bg-gray-950 dark:text-gray-100 sm:px-4 lg:px-6">
      <div className="mx-auto max-w-6xl space-y-4 lg:space-y-6">
        <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-end sm:justify-between dark:border-gray-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
              Zugriff
            </p>
            <h1 className="text-3xl font-semibold">Alle Tags</h1>
          </div>
          <div className="inline-flex rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            {filteredTags.length} sichtbar
          </div>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:p-5">
          <label className="mb-2 block text-sm font-medium text-gray-600 dark:text-gray-300">
            Tags durchsuchen
          </label>
          <Input
            placeholder="Tag-Name"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </section>

        <section className="grid gap-3 xl:grid-cols-2">
          {filteredTags.map((tag) => (
            <article
              key={tag.id}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Tag</p>
              <Link href={`/tags/${tag.id}`} className="mt-2 block text-lg font-semibold hover:text-blue-600 dark:hover:text-blue-400">
                {tag.name}
              </Link>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {tag.item_count} Items
                {tag.location_count ? ` | ${tag.location_count} Locations` : ""}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditTag(tag);
                    setEditName(tag.name);
                  }}
                >
                  Bearbeiten
                </Button>
                <Button variant="danger" onClick={() => setDeleteTag(tag)}>
                  Löschen
                </Button>
              </div>
            </article>
          ))}
        </section>
      </div>
      <FloatingCreateButton ariaLabel="Neuen Tag anlegen" onClick={() => setCreateOpen(true)} />

      {createOpen ? (
        <Modal>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Tag anlegen</h3>
            <Input
              placeholder="Tag-Name"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
            />
            <div className="flex justify-between">
              <Button
                onClick={() => {
                  setCreateOpen(false);
                  setCreateName("");
                }}
              >
                Abbrechen
              </Button>
              <Button variant="primary" onClick={() => void createTag()} disabled={submitting}>
                {submitting ? "Speichert..." : "Erstellen"}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {editTag ? (
        <Modal>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Tag bearbeiten</h3>
            <Input placeholder="Tag-Name" value={editName} onChange={(event) => setEditName(event.target.value)} />
            <div className="flex justify-between">
              <Button
                onClick={() => {
                  setEditTag(null);
                  setEditName("");
                }}
              >
                Abbrechen
              </Button>
              <Button variant="primary" onClick={() => void updateTag()} disabled={submitting}>
                {submitting ? "Speichert..." : "Speichern"}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {deleteTag ? (
        <Modal>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Tag löschen</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              <span className="font-medium">{deleteTag.name}</span> wird entfernt. Bestehende Zuordnungen zu Items und Locations werden ebenfalls gelöst.
            </p>
            <div className="flex justify-between">
              <Button onClick={() => setDeleteTag(null)}>Abbrechen</Button>
              <Button variant="danger" onClick={() => void removeTag()} disabled={submitting}>
                Löschen
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
