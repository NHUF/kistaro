import type { InventoryActivityRecord } from "@/lib/inventory-data";

function formatDate(value: string) {
  return new Date(value).toLocaleString("de-DE");
}

function getActionLabel(action: InventoryActivityRecord["action"]) {
  switch (action) {
    case "create":
      return "Neu";
    case "update":
      return "Bearbeitet";
    case "delete":
      return "Gelöscht";
    case "move":
      return "Verschoben";
    case "attach":
      return "Verknüpft";
    case "detach":
      return "Gelöst";
    default:
      return action;
  }
}

function getActionClass(action: InventoryActivityRecord["action"]) {
  switch (action) {
    case "create":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "delete":
      return "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300";
    case "move":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300";
    case "attach":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
    case "detach":
      return "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

function getEntityLabel(entityType: string) {
  switch (entityType) {
    case "location":
      return "Location";
    case "item":
      return "Item";
    case "tag":
      return "Tag";
    case "template":
      return "Vorlage";
    case "document":
      return "Dokument";
    case "item-link":
      return "Item-Verknüpfung";
    case "item-tag":
      return "Item-Tag";
    case "location-tag":
      return "Location-Tag";
    default:
      return entityType;
  }
}

export function LogIndexPage({ activity }: { activity: InventoryActivityRecord[] }) {
  return (
    <div className="min-h-screen bg-gray-100 px-3 py-4 text-gray-800 dark:bg-gray-950 dark:text-gray-100 sm:px-4 lg:px-6">
      <div className="mx-auto max-w-6xl space-y-4 lg:space-y-6">
        <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-end sm:justify-between dark:border-gray-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
              Verlauf
            </p>
            <h1 className="text-3xl font-semibold">Log</h1>
          </div>
          <div className="inline-flex rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            {activity.length} Einträge
          </div>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Alle über die App ausgelösten Änderungen mit Zeit, Gerät und Aktion.
            </p>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {activity.length > 0 ? (
              activity.map((entry) => (
                <article key={entry.id} className="px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getActionClass(entry.action)}`}
                        >
                          {getActionLabel(entry.action)}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                          {getEntityLabel(entry.entity_type)}
                        </span>
                      </div>
                      <h2 className="mt-3 text-base font-semibold text-gray-900 dark:text-gray-100">
                        {entry.title}
                      </h2>
                      {entry.description ? (
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                          {entry.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="shrink-0 text-sm text-gray-500 dark:text-gray-400 lg:text-right">
                      <p>{formatDate(entry.created_at)}</p>
                      <p className="mt-1">{entry.actor_label || "Unbekanntes Gerät"}</p>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="px-4 py-8 text-sm text-gray-500 dark:text-gray-400">
                Noch keine Einträge vorhanden.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
