"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export type ResourceLinkDraft = {
  id?: string;
  label: string;
  url: string;
};

export function toResourceLinkDrafts(
  links?: Array<{ id?: string; label: string; url: string }> | null
): ResourceLinkDraft[] {
  return (links ?? []).map((link) => ({
    id: link.id,
    label: link.label ?? "",
    url: link.url ?? "",
  }));
}

export function normalizeResourceLinkDrafts(drafts: ResourceLinkDraft[]) {
  return drafts
    .map((draft) => ({
      label: draft.label.trim(),
      url: draft.url.trim(),
    }))
    .filter((draft) => {
      if (!draft.label && !draft.url) {
        return false;
      }

      if (!draft.label || !draft.url) {
        throw new Error("Bitte bei jedem Link Anzeigename und URL ausfüllen.");
      }

      return true;
    });
}

export function ResourceLinksEditor({
  label = "Links",
  onChange,
  value,
}: {
  label?: string;
  onChange: (links: ResourceLinkDraft[]) => void;
  value: ResourceLinkDraft[];
}) {
  function updateLink(index: number, patch: Partial<ResourceLinkDraft>) {
    onChange(value.map((link, currentIndex) => (currentIndex === index ? { ...link, ...patch } : link)));
  }

  function removeLink(index: number) {
    onChange(value.filter((_, currentIndex) => currentIndex !== index));
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{label}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Optional: Rechnungen, Herstellerseiten, Anleitungen oder andere Verweise.
          </p>
        </div>
        <Button variant="ghost" onClick={() => onChange([...value, { label: "", url: "" }])}>
          Link hinzufügen
        </Button>
      </div>

      {value.length > 0 ? (
        <div className="space-y-2">
          {value.map((link, index) => (
            <div key={link.id ?? index} className="grid gap-2 md:grid-cols-[1fr_1.4fr_auto]">
              <Input
                placeholder="Anzeigename"
                value={link.label}
                onChange={(event) => updateLink(index, { label: event.target.value })}
              />
              <Input
                placeholder="https://..."
                value={link.url}
                onChange={(event) => updateLink(index, { url: event.target.value })}
              />
              <Button variant="ghost" onClick={() => removeLink(index)}>
                Entfernen
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-gray-200 px-3 py-3 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          Noch keine Links hinterlegt.
        </p>
      )}
    </div>
  );
}

export function ResourceLinksList({
  links,
}: {
  links: Array<{ id?: string; label: string; url: string }>;
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-900">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Links</p>
        <h3 className="text-lg font-semibold">Externe Verweise</h3>
      </div>

      <div className="space-y-2">
        {links.length > 0 ? (
          links.map((link) => (
            <a
              key={link.id ?? `${link.label}-${link.url}`}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-xl border border-gray-200 px-3 py-3 text-sm font-medium text-blue-600 transition hover:border-blue-200 hover:bg-blue-50 hover:underline dark:border-gray-700 dark:text-blue-400 dark:hover:border-blue-900 dark:hover:bg-blue-950/30"
            >
              {link.label}
            </a>
          ))
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">Noch keine Links hinterlegt.</p>
        )}
      </div>
    </section>
  );
}
