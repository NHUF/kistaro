"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type TagDraftEditorProps = {
  availableTags?: string[];
  label?: string;
  onChange: (tags: string[]) => void;
  value: string[];
};

function normalizeTagName(value: string) {
  return value.trim();
}

export function TagDraftEditor({
  availableTags = [],
  label = "Tags",
  onChange,
  value,
}: TagDraftEditorProps) {
  const [newTagName, setNewTagName] = useState("");

  function addTag(tagName: string) {
    const normalizedTag = normalizeTagName(tagName);

    if (!normalizedTag) {
      return;
    }

    if (value.some((tag) => tag.toLowerCase() === normalizedTag.toLowerCase())) {
      setNewTagName("");
      return;
    }

    onChange([...value, normalizedTag]);
    setNewTagName("");
  }

  function removeTag(tagName: string) {
    onChange(value.filter((tag) => tag !== tagName));
  }

  const availableSuggestions = availableTags.filter(
    (tag) => !value.some((selectedTag) => selectedTag.toLowerCase() === tag.toLowerCase()),
  );

  return (
    <section className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="mb-3">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Optional: Schlagwörter direkt beim Anlegen mitgeben.
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Tag eingeben"
          value={newTagName}
          onChange={(event) => setNewTagName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addTag(newTagName);
            }
          }}
        />
        <Button variant="primary" onClick={() => addTag(newTagName)}>
          Hinzufügen
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {value.length > 0 ? (
          value.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => removeTag(tag)}
              className="rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-600 transition hover:border-red-300 hover:text-red-600 dark:border-gray-700 dark:text-gray-300"
            >
              {tag} x
            </button>
          ))
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">Noch keine Tags gewählt.</p>
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
                key={tag}
                type="button"
                onClick={() => addTag(tag)}
                className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
