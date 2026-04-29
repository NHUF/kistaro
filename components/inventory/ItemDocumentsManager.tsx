"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { logInventoryActivity } from "@/lib/inventory-activity";
import { removeInventoryDocument, uploadInventoryDocument, getInventoryDocumentUrl } from "@/lib/inventory-media";
import { supabase } from "@/lib/supabase";
import type { ItemDocumentRecord } from "@/lib/inventory-data";

const DOCUMENT_TYPE_OPTIONS = [
  "Rechnung",
  "Garantie",
  "Anleitung",
  "Datenblatt",
  "Notiz",
] as const;

export function ItemDocumentsManager({
  documents,
  itemId,
  onChange,
}: {
  documents: ItemDocumentRecord[];
  itemId: string;
  onChange: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);

  function getDefaultTitle(fileName: string) {
    return fileName.replace(/\.[^.]+$/, "");
  }

  async function addDocument() {
    if (!title.trim()) {
      window.alert("Titel ist erforderlich.");
      return;
    }

    if (!file) {
      window.alert("Bitte ein Dokument auswählen.");
      return;
    }

    setBusy(true);
    let uploadedPath: string | null = null;

    try {
      uploadedPath = await uploadInventoryDocument(file);

      const { error } = await supabase.rpc("create_item_document", {
        target_item_id: itemId,
        document_title: title.trim(),
        document_type: documentType || null,
        document_file_path: uploadedPath,
      });

      if (error) {
        if (uploadedPath) {
          await removeInventoryDocument(uploadedPath);
        }
        window.alert(error.message);
        return;
      }

      await logInventoryActivity({
        action: "create",
        entityId: itemId,
        entityType: "document",
        title: `Dokument hinzugefügt: ${title.trim()}`,
        description: documentType ? `${documentType} zu einem Item gespeichert.` : "Dokument zu einem Item gespeichert.",
        metadata: {
          item_id: itemId,
          document_type: documentType || null,
        },
      });

      setTitle("");
      setDocumentType("");
      setFile(null);
      setTitleTouched(false);
      await onChange();
    } catch (error) {
      if (uploadedPath) {
        await removeInventoryDocument(uploadedPath);
      }
      window.alert(error instanceof Error ? error.message : "Dokument konnte nicht hochgeladen werden.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDocument(document: ItemDocumentRecord) {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("delete_item_document", {
        target_document_id: document.id,
      });

      if (error) {
        window.alert(error.message);
        return;
      }

      await logInventoryActivity({
        action: "delete",
        entityId: itemId,
        entityType: "document",
        title: `Dokument gelöscht: ${document.title}`,
        description: "Dokument wurde von einem Item entfernt.",
        metadata: {
          item_id: itemId,
          document_id: document.id,
          document_type: document.document_type || null,
        },
      });

      await removeInventoryDocument(document.file_path);
      await onChange();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Dokument konnte nicht gelöscht werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm dark:bg-gray-900">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Dokumente</p>
          <h2 className="mt-2 text-xl font-semibold">Rechnungen, Garantie, Anleitung</h2>
        </div>
        <div className="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-300">
          {documents.length} Datei{documents.length === 1 ? "" : "en"}
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
        <Input
          placeholder="Dokumenttitel"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setTitleTouched(true);
          }}
        />
        <select
          value={documentType}
          onChange={(event) => setDocumentType(event.target.value)}
          className="w-full rounded-md border bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-700"
        >
          <option value="">Typ offen lassen</option>
          {DOCUMENT_TYPE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <input
          type="file"
          onChange={(event) => {
            const nextFile = event.target.files?.[0] ?? null;
            setFile(nextFile);

            if (!nextFile) {
              if (!titleTouched) {
                setTitle("");
              }
              return;
            }

            if (!titleTouched || !title.trim()) {
              setTitle(getDefaultTitle(nextFile.name));
              setTitleTouched(false);
            }
          }}
          className="block w-full text-sm text-gray-500 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200 dark:file:bg-gray-700 dark:file:text-gray-100"
        />
        <div className="flex justify-end">
          <Button variant="primary" onClick={() => void addDocument()} disabled={busy}>
                    Dokument hinzufügen
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {documents.length > 0 ? (
          documents.map((document) => {
            const url = getInventoryDocumentUrl(document.file_path);

            return (
              <div
                key={document.id}
                className="flex items-start justify-between gap-4 rounded-2xl bg-gray-50 px-4 py-4 dark:bg-gray-800"
              >
                <div>
                  <p className="font-medium">{document.title}</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {document.document_type || "Dokument"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {url ? (
                    <Link
                      href={url}
                      target="_blank"
                      className="rounded-md bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-950"
                    >
                      Öffnen
                    </Link>
                  ) : null}
                  <Button variant="danger" onClick={() => void deleteDocument(document)} disabled={busy}>
                    Entfernen
                  </Button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Noch keine Dokumente zu diesem Item hinterlegt.
          </p>
        )}
      </div>
    </section>
  );
}
