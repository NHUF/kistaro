import Link from "next/link";

export function DetailLoadError({
  backHref,
  backLabel,
  entityId,
  entityLabel,
}: {
  backHref: string;
  backLabel: string;
  entityId: string;
  entityLabel: string;
}) {
  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8 text-gray-800 dark:bg-gray-950 dark:text-gray-100">
      <div className="mx-auto max-w-2xl rounded-3xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-950 dark:bg-gray-900">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-500">
          Detailseite konnte nicht geladen werden
        </p>
        <h1 className="mt-3 text-2xl font-semibold">{entityLabel}</h1>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
          Die Daten fuer diesen Eintrag konnten gerade nicht vollstaendig gelesen werden.
          Die Seite bleibt dadurch wenigstens erreichbar, statt komplett abzustuerzen.
        </p>
        <p className="mt-3 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-300">
          ID: {entityId}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={backHref}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
          >
            {backLabel}
          </Link>
          <Link
            href="/"
            className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Zum Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
