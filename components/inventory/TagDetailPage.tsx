"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DetailField } from "@/components/inventory/DetailField";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { logInventoryActivity } from "@/lib/inventory-activity";
import { getItemStatusLabel } from "@/lib/inventory";
import type { TagDetailData } from "@/lib/inventory-data";
import { supabase } from "@/lib/supabase";

export function TagDetailPage({ initialData }: { initialData: TagDetailData }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editName, setEditName] = useState(initialData.tag?.name ?? "");
  const [submitting, setSubmitting] = useState(false);

  if (!initialData.tag) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Tag nicht gefunden.</p>
        <Link href="/tags" className="mt-4 inline-block text-sm text-blue-600">
          Zurück zu allen Tags
        </Link>
      </div>
    );
  }

  async function updateTag() {
    if (!initialData.tag) {
      return;
    }

    const nextName = editName.trim();

    if (!nextName) {
      window.alert("Bitte einen Tag-Namen eingeben.");
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.from("tags").update({ name: nextName }).eq("id", initialData.tag.id);

      if (error) {
        window.alert(error.message);
        return;
      }

      await logInventoryActivity({
        action: "update",
        entityId: initialData.tag.id,
        entityType: "tag",
        title: `Tag bearbeitet: ${nextName}`,
        description: `Tag wurde von "${initialData.tag.name}" auf "${nextName}" umbenannt.`,
      });

      setEditOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteTag() {
    if (!initialData.tag) {
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.from("tags").delete().eq("id", initialData.tag.id);

      if (error) {
        window.alert(error.message);
        return;
      }

      await logInventoryActivity({
        action: "delete",
        entityId: initialData.tag.id,
        entityType: "tag",
        title: `Tag gelöscht: ${initialData.tag.name}`,
        description: "Tag und alle Zuordnungen wurden entfernt.",
      });

      router.push("/tags");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 text-gray-800 dark:bg-gray-950 dark:text-gray-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/tags" className="text-sm text-blue-600 dark:text-blue-400">
              Zurück zu allen Tags
            </Link>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Tag</p>
            <h1 className="text-3xl font-semibold">{initialData.tag.name}</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setEditOpen(true)}>
              Bearbeiten
            </Button>
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>
              Löschen
            </Button>
          </div>
        </div>

        <section className="rounded-3xl bg-white p-6 shadow-sm dark:bg-gray-900">
          <div className="grid gap-4 md:grid-cols-2">
            <DetailField label="Items" value={String(initialData.usage?.item_count ?? 0)} />
            <DetailField label="Locations" value={String(initialData.usage?.location_count ?? 0)} />
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm dark:bg-gray-900">
          <p className="mb-4 text-sm font-medium text-gray-600 dark:text-gray-300">
            Items mit diesem Tag
          </p>
          <div className="space-y-3">
            {initialData.items.length > 0 ? (
              initialData.items.map((item) => (
                <Link
                  key={item.id}
                  href={`/items/${item.id}`}
                  className="block rounded-2xl bg-gray-50 px-4 py-4 transition hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700"
                >
                  <h2 className="text-lg font-semibold">{item.name}</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {getItemStatusLabel(item.status)}
                  </p>
                  {item.description ? (
                    <p className="mt-2 line-clamp-2 whitespace-pre-line text-sm text-gray-600 dark:text-gray-300">
                      {item.description}
                    </p>
                  ) : null}
                </Link>
              ))
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Diesem Tag sind aktuell keine Items zugeordnet.
              </p>
            )}
          </div>
        </section>
      </div>

      {editOpen ? (
        <Modal>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Tag bearbeiten</h3>
            <Input placeholder="Tag-Name" value={editName} onChange={(event) => setEditName(event.target.value)} />
            <div className="flex justify-between">
              <Button
                onClick={() => {
                  setEditName(initialData.tag?.name ?? "");
                  setEditOpen(false);
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

      {deleteOpen ? (
        <Modal>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Tag löschen</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              <span className="font-medium">{initialData.tag.name}</span> wird entfernt. Bestehende Zuordnungen zu Items und Locations werden ebenfalls gelöst.
            </p>
            <div className="flex justify-between">
              <Button onClick={() => setDeleteOpen(false)}>Abbrechen</Button>
              <Button variant="danger" onClick={() => void deleteTag()} disabled={submitting}>
                Löschen
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
