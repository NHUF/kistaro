"use client";

import Link from "next/link";
import { DetailField } from "@/components/inventory/DetailField";
import { getItemStatusLabel } from "@/lib/inventory";
import type { TagDetailData } from "@/lib/inventory-data";

export function TagDetailPage({ initialData }: { initialData: TagDetailData }) {
  if (!initialData.tag) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Tag nicht gefunden.</p>
        <Link href="/tags" className="mt-4 inline-block text-sm text-blue-600">
          Zurueck zu allen Tags
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 text-gray-800 dark:bg-gray-950 dark:text-gray-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link href="/tags" className="text-sm text-blue-600 dark:text-blue-400">
            Zurueck zu allen Tags
          </Link>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Tag</p>
          <h1 className="text-3xl font-semibold">{initialData.tag.name}</h1>
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
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{item.description}</p>
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
    </div>
  );
}
