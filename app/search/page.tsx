import type { ReactNode } from "react";
import Link from "next/link";
import { FloatingCreateButton } from "@/components/inventory/FloatingCreateButton";
import { fetchSearchResults } from "@/lib/inventory-data";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const activeType =
    params.type === "location" || params.type === "item" || params.type === "tag"
      ? params.type
      : "all";
  const results = await fetchSearchResults(query);
  const filteredResults =
    activeType === "all"
      ? results
      : results.filter((result) => result.result_type === activeType);

  return (
    <div className="min-h-screen bg-gray-100 px-3 py-4 text-gray-800 dark:bg-gray-950 dark:text-gray-100 sm:px-4 lg:px-6">
      <div className="mx-auto max-w-6xl space-y-4 lg:space-y-6">
        <div className="border-b border-gray-200 pb-4 dark:border-gray-800">
          <Link href="/" className="text-sm text-blue-600 dark:text-blue-400">
            Zurück zum Dashboard
          </Link>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
            Suche
          </p>
          <h1 className="text-3xl font-semibold">Alle Treffer</h1>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:p-5">
          <form action="/search" className="space-y-3">
            <label htmlFor="global-search" className="block text-sm font-medium text-gray-600 dark:text-gray-300">
              Alles durchsuchen: Locations, Items, Tags, Status
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="global-search"
                name="q"
                defaultValue={query}
                placeholder="z. B. Keller, Werkzeug, verborgt, Karton"
                className="w-full rounded-md border bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
              />
              <button
                type="submit"
                className="rounded-md bg-green-600 px-4 py-2 text-white transition hover:bg-green-700"
              >
                Suchen
              </button>
            </div>
          </form>
        </section>

        {query ? (
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Suchbegriff: <span className="font-medium text-gray-700 dark:text-gray-200">{query}</span>
                </p>
              </div>
              <div className="inline-flex rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                {filteredResults.length} Treffer
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <SearchFilterChip
                href={`/search?q=${encodeURIComponent(query)}`}
                active={activeType === "all"}
              >
                Alle
              </SearchFilterChip>
              <SearchFilterChip
                href={`/search?q=${encodeURIComponent(query)}&type=location`}
                active={activeType === "location"}
              >
                Locations
              </SearchFilterChip>
              <SearchFilterChip
                href={`/search?q=${encodeURIComponent(query)}&type=item`}
                active={activeType === "item"}
              >
                Items
              </SearchFilterChip>
              <SearchFilterChip
                href={`/search?q=${encodeURIComponent(query)}&type=tag`}
                active={activeType === "tag"}
              >
                Tags
              </SearchFilterChip>
            </div>

            <div className="space-y-3">
              {filteredResults.length > 0 ? (
                filteredResults.map((result) => (
                  <Link
                    key={`${result.result_type}-${result.result_id}`}
                    href={result.href}
                    className="block rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 transition hover:border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                          {result.result_type === "location"
                            ? "Location"
                            : result.result_type === "item"
                              ? "Item"
                              : "Tag"}
                        </p>
                        <h2 className="mt-1 text-lg font-semibold">{result.title}</h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {result.subtitle ?? "-"}
                        </p>
                        {result.meta ? (
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{result.meta}</p>
                        ) : null}
                      </div>
                      <span className="text-sm font-medium text-green-700 dark:text-green-400">
                        Öffnen
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Keine Treffer gefunden.
                </p>
              )}
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:p-5">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Gib einen Suchbegriff ein, um Locations, Items, Tags und Statuswerte gemeinsam zu durchsuchen.
            </p>
          </section>
        )}
      </div>
      <FloatingCreateButton ariaLabel="Neu anlegen" href="/" createType="item" />
    </div>
  );
}

function SearchFilterChip({
  active,
  children,
  href,
}: {
  active: boolean;
  children: ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-2 text-sm transition ${
        active
          ? "bg-green-600 text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      }`}
    >
      {children}
    </Link>
  );
}
