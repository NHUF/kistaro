"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { logInventoryActivity } from "@/lib/inventory-activity";
import { supabase } from "@/lib/supabase";
import type { ResourceLinkRecord } from "@/lib/inventory-data";

export function ResourceLinksManager({
  entityId,
  entityType,
  links,
  onChange,
}: {
  entityId: string;
  entityType: "item" | "location";
  links: ResourceLinkRecord[];
  onChange: () => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function addLink() {
    const nextLabel = label.trim();
    const nextUrl = url.trim();

    if (!nextLabel || !nextUrl) {
      window.alert("Bitte Name und URL ausfüllen.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.rpc("create_resource_link", {
      target_entity_type: entityType,
      target_entity_id: entityId,
      link_label: nextLabel,
      link_url: nextUrl,
    });
    setBusy(false);

    if (error) {
      window.alert(error.message);
      return;
    }

    await logInventoryActivity({
      action: "attach",
      entityId,
      entityType: `${entityType}-link`,
      title: `Link hinzugefügt: ${nextLabel}`,
      description: `${entityType === "item" ? "Item" : "Location"} wurde um einen Link ergänzt.`,
      metadata: { url: nextUrl },
    });

    setLabel("");
    setUrl("");
    await onChange();
  }

  async function removeLink(link: ResourceLinkRecord) {
    setBusy(true);
    const { error } = await supabase.rpc("delete_resource_link", {
      target_link_id: link.id,
    });
    setBusy(false);

    if (error) {
      window.alert(error.message);
      return;
    }

    await logInventoryActivity({
      action: "detach",
      entityId,
      entityType: `${entityType}-link`,
      title: `Link entfernt: ${link.label}`,
      description: "Ein hinterlegter Link wurde entfernt.",
      metadata: { link_id: link.id },
    });
    await onChange();
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-900">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Links</p>
        <h3 className="text-lg font-semibold">Externe Verweise</h3>
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_1.5fr_auto]">
        <Input placeholder="Anzeigename" value={label} onChange={(event) => setLabel(event.target.value)} />
        <Input placeholder="https://..." value={url} onChange={(event) => setUrl(event.target.value)} />
        <Button variant="primary" onClick={() => void addLink()} disabled={busy}>
          Hinzufügen
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {links.length > 0 ? (
          links.map((link) => (
            <div
              key={link.id}
              className="flex flex-col gap-2 rounded-xl border border-gray-200 px-3 py-3 text-sm dark:border-gray-700 md:flex-row md:items-center md:justify-between"
            >
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                {link.label}
              </a>
              <Button variant="ghost" onClick={() => void removeLink(link)} disabled={busy}>
                Entfernen
              </Button>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">Noch keine Links hinterlegt.</p>
        )}
      </div>
    </section>
  );
}
