"use client";

import { useEffect, useMemo, useState } from "react";
import { MdExpandLess, MdExpandMore } from "react-icons/md";
import {
  getMaterialIconLabel,
  MaterialIcon,
} from "@/components/inventory/InventoryIcon";
import { Input } from "@/components/ui/Input";

export function IconPicker({
  label = "Icon",
  value,
  onChange,
  emptyLabel = "Automatisch waehlen",
}: {
  label?: string;
  value: string;
  onChange: (nextValue: string) => void;
  emptyLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [allOptions, setAllOptions] = useState<Array<{ value: string; label: string }>>([]);

  useEffect(() => {
    if (!expanded || allOptions.length > 0) {
      return;
    }

    let active = true;

    void import("react-icons/md")
      .then((module) => {
        if (!active) {
          return;
        }

        const nextOptions = Object.keys(module)
          .filter((name) => name.startsWith("Md") && typeof module[name as keyof typeof module] === "function")
          .sort((a, b) => getMaterialIconLabel(a)?.localeCompare(getMaterialIconLabel(b) ?? "", "de") ?? 0)
          .map((name) => ({
            value: name,
            label: getMaterialIconLabel(name) ?? name,
          }));

        setAllOptions(nextOptions);
      });

    return () => {
      active = false;
    };
  }, [allOptions.length, expanded]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const sourceOptions =
      allOptions.length > 0
        ? allOptions
        : [
            { value: "MdCategory", label: "Category" },
            { value: "MdLocationOn", label: "Location On" },
            { value: "MdMeetingRoom", label: "Meeting Room" },
            { value: "MdCheckroom", label: "Checkroom" },
            { value: "MdInventory2", label: "Inventory 2" },
            { value: "MdArchive", label: "Archive" },
            { value: "MdInbox", label: "Inbox" },
            { value: "MdHomeWork", label: "Home Work" },
            { value: "MdMoveToInbox", label: "Move To Inbox" },
            { value: "MdSearchOff", label: "Search Off" },
            { value: "MdKeyboardDoubleArrowRight", label: "Keyboard Double Arrow Right" },
          ].map((option) => ({
            value: option.value,
            label: getMaterialIconLabel(option.value) ?? option.label,
          }));

    if (!normalizedQuery) {
      return sourceOptions.slice(0, 120);
    }

    return sourceOptions.filter((option) => {
      return (
        option.label.toLowerCase().includes(normalizedQuery) ||
        option.value.toLowerCase().includes(normalizedQuery)
      );
    }).slice(0, 120);
  }, [allOptions, query]);

  return (
    <div className="space-y-2 rounded-2xl border border-gray-200 p-3 dark:border-gray-700">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2 text-left transition hover:bg-gray-100 dark:bg-gray-800/60 dark:hover:bg-gray-800"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
          <span className="mt-1 flex items-center gap-2 text-xs text-gray-400">
            {value ? (
              <>
                <MaterialIcon name={value} className="h-4 w-4" />
                <span className="truncate">{getMaterialIconLabel(value)}</span>
              </>
            ) : (
              <span>{emptyLabel}</span>
            )}
          </span>
        </span>
        {expanded ? (
          <MdExpandLess className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
        ) : (
          <MdExpandMore className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
        )}
      </button>

      {expanded ? (
        <>
          <Input
            placeholder="Icon suchen"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <button
            type="button"
            onClick={() => onChange("")}
            className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
              value === ""
                ? "border-green-500 bg-green-50 text-green-800 dark:border-green-400 dark:bg-green-950/30 dark:text-green-200"
                : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            }`}
          >
            <span>{emptyLabel}</span>
            <span className="text-xs text-gray-400">Kein fixes Icon</span>
        </button>

        <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {expanded && allOptions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400 sm:col-span-2">
              Icon-Katalog wird geladen...
            </div>
          ) : null}
          {filteredOptions.map((option) => (
            <button
              key={option.value}
                type="button"
                onClick={() => onChange(option.value)}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                  value === option.value
                    ? "border-green-500 bg-green-50 text-green-800 dark:border-green-400 dark:bg-green-950/30 dark:text-green-200"
                    : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                }`}
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                  <MaterialIcon name={option.value} className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{option.label}</span>
                  <span className="block truncate text-xs text-gray-400">{option.value}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
