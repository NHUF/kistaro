"use client";

import { useEffect, useState, useTransition } from "react";
import { MdCloudDone, MdDataset, MdDownload, MdKey, MdOpenInNew, MdOutlineStorage, MdRefresh, MdSecurity, MdSystemUpdateAlt, MdUploadFile } from "react-icons/md";
import type { IntegrityReport } from "@/lib/system-integrity-types";
import type { SystemStatusData } from "@/lib/system-status";
import type { UpdateCheckResult } from "@/lib/system-updates";

type Props = {
  status: SystemStatusData;
};

const GITHUB_REPOSITORY_URL = "https://github.com/NHUF/kistaro";

export function SystemPage({ status }: Props) {
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    nextPassword: "",
    confirmPassword: "",
  });
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [updatePolling, setUpdatePolling] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [integrityReport, setIntegrityReport] = useState<IntegrityReport | null>(null);
  const [integrityMessage, setIntegrityMessage] = useState<string | null>(null);
  const [repairTargets, setRepairTargets] = useState<Record<string, string>>({});
  const [passwordPending, startPasswordTransition] = useTransition();
  const [restorePending, startRestoreTransition] = useTransition();
  const [updatePending, startUpdateTransition] = useTransition();
  const [integrityPending, startIntegrityTransition] = useTransition();

  function handlePasswordChange(field: keyof typeof passwordForm, value: string) {
    setPasswordForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function submitPasswordChange() {
    setPasswordMessage(null);

    startPasswordTransition(async () => {
      const response = await fetch("/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(passwordForm),
      });

      const result = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setPasswordMessage(result.error ?? "Passwort konnte nicht geändert werden.");
        return;
      }

      setPasswordMessage(result.message ?? "Passwort geändert.");
      setPasswordForm({
        currentPassword: "",
        nextPassword: "",
        confirmPassword: "",
      });

      window.location.href = "/unlock?message=password_changed";
    });
  }

  async function downloadBackup() {
    const response = await fetch("/api/system/backup", {
      method: "GET",
    });

    if (!response.ok) {
      setRestoreMessage("Backup konnte nicht erstellt werden.");
      return;
    }

    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const disposition = response.headers.get("Content-Disposition");
    const fileName =
      disposition?.match(/filename="(.+)"/)?.[1] ?? "inventar-backup.zip";

    anchor.href = downloadUrl;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(downloadUrl);
    setRestoreMessage("Backup wurde heruntergeladen.");
  }

  async function uploadBackupReplace() {
    if (!selectedFile) {
      setRestoreMessage("Bitte zuerst eine Backup-Datei auswählen.");
      return;
    }

    setRestoreMessage(null);

    startRestoreTransition(async () => {
      const formData = new FormData();
      formData.set("mode", "replace");
      formData.set("file", selectedFile);

      const response = await fetch("/api/system/backup", {
        method: "POST",
        body: formData,
      });

      const result = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setRestoreMessage(result.error ?? "Backup konnte nicht eingespielt werden.");
        return;
      }

      setRestoreMessage(result.message ?? "Backup eingespielt.");
      setSelectedFile(null);
      window.location.reload();
    });
  }

  async function checkUpdates() {
    setUpdateMessage(null);

    startUpdateTransition(async () => {
      const response = await fetch("/api/system/update", {
        method: "GET",
      });
      const result = (await response.json()) as UpdateCheckResult;

      setUpdateInfo(result);
      setUpdatePolling(result.updateStatus?.state === "running");

      if (!response.ok || result.error) {
        setUpdateMessage(result.error ?? "Update-Prüfung ist fehlgeschlagen.");
        return;
      }

      setUpdateMessage(
        result.updateAvailable
          ? `Version ${result.latestTag ?? result.latestVersion} ist verfügbar.`
          : "Die installierte Version ist aktuell.",
      );
    });
  }

  async function installUpdate(force = false) {
    setUpdateMessage(null);
    setUpdatePolling(true);

    startUpdateTransition(async () => {
      const response = await fetch("/api/system/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ force }),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        targetVersion?: string;
        updateStatus?: UpdateCheckResult["updateStatus"];
      };

      if (!response.ok) {
        setUpdateMessage(result.error ?? "Update konnte nicht gestartet werden.");
        setUpdatePolling(false);
        return;
      }

      setUpdateInfo((current) =>
        current
          ? {
              ...current,
              updateStatus: result.updateStatus ?? current.updateStatus,
            }
          : current,
      );

      setUpdateMessage(
        result.message ??
          `${force ? "Neuinstallation" : "Update"} auf Version ${result.targetVersion ?? "neu"} wurde gestartet.`,
      );
    });
  }

  async function checkIntegrity() {
    setIntegrityMessage(null);

    startIntegrityTransition(async () => {
      const response = await fetch("/api/system/integrity", {
        method: "GET",
        cache: "no-store",
      });
      const result = (await response.json()) as IntegrityReport & { error?: string };

      if (!response.ok) {
        setIntegrityMessage(result.error ?? "Integritaetspruefung ist fehlgeschlagen.");
        return;
      }

      setIntegrityReport(result);
      setIntegrityMessage(
        result.issueCount > 0
          ? `${result.issueCount} Auffaelligkeiten gefunden.`
          : "Keine defekten Eintraege gefunden.",
      );
    });
  }

  async function repairIssue(issueId: string) {
    setIntegrityMessage(null);

    startIntegrityTransition(async () => {
      const response = await fetch("/api/system/integrity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "repair",
          issueId,
          targetLocationId: repairTargets[issueId] || null,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        report?: IntegrityReport;
      };

      if (!response.ok) {
        setIntegrityMessage(result.error ?? "Defekt konnte nicht repariert werden.");
        return;
      }

      if (result.report) {
        setIntegrityReport(result.report);
      }

      setIntegrityMessage(result.message ?? "Defekt wurde repariert.");
    });
  }

  async function repairAllSafeIssues() {
    setIntegrityMessage(null);

    startIntegrityTransition(async () => {
      const response = await fetch("/api/system/integrity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "repair_all_safe",
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        report?: IntegrityReport;
      };

      if (!response.ok) {
        setIntegrityMessage(result.error ?? "Automatische Reparatur ist fehlgeschlagen.");
        return;
      }

      if (result.report) {
        setIntegrityReport(result.report);
      }

      setIntegrityMessage(result.message ?? "Reparatur abgeschlossen.");
    });
  }

  useEffect(() => {
    if (!updatePolling) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetch("/api/system/update", {
          method: "GET",
          cache: "no-store",
        });
        const result = (await response.json()) as UpdateCheckResult;

        setUpdateInfo(result);

        if (result.updateStatus?.state === "completed") {
          setUpdateMessage("Update abgeschlossen. Bitte Seite neu laden, falls die neue Version noch nicht sichtbar ist.");
          setUpdatePolling(false);
        }

        if (result.updateStatus?.state === "failed") {
          setUpdateMessage(result.updateStatus.message ?? "Update ist fehlgeschlagen.");
          setUpdatePolling(false);
        }
      } catch {
        setUpdateMessage("Update läuft vermutlich weiter. Verbindung wird nach Dienst-Neustart erneut aufgebaut.");
      }
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [updatePolling]);

  const updateStatus = updateInfo?.updateStatus ?? null;
  const showUpdateProgress = updatePending || updatePolling || updateStatus?.state === "running";
  const updateProgress = Math.max(0, Math.min(100, updateStatus?.progress ?? (updatePending ? 10 : 0)));

  const statusCards = [
    {
      label: "Datenbank",
      value: status.databaseConnected ? "Verbunden" : "Fehler",
      meta: status.databaseLabel,
      icon: MdDataset,
      accent: status.databaseConnected ? "text-emerald-700" : "text-red-700",
    },
    {
      label: "Storage",
      value: "Aktiv",
      meta: status.storageLabel,
      icon: MdOutlineStorage,
      accent: "text-blue-700",
    },
    {
      label: "Zugriff",
      value: status.authConfigured ? "Geschützt" : "Offen",
      meta: `Quelle: ${status.authSource}`,
      icon: MdSecurity,
      accent: status.authConfigured ? "text-amber-700" : "text-red-700",
    },
    {
      label: "App",
      value: `v${status.appVersion}`,
      meta: status.runtime,
      icon: MdCloudDone,
      accent: "text-gray-800 dark:text-gray-100",
    },
  ];

  const metrics = [
    { label: "Locations", value: status.locationCount },
    { label: "Items", value: status.itemCount },
    { label: "Tags", value: status.tagCount },
    { label: "Vorlagen", value: status.templateCount },
  ];

  return (
    <div className="min-h-screen bg-gray-100 px-3 py-4 text-gray-800 dark:bg-gray-950 dark:text-gray-100 sm:px-4 lg:px-6">
      <div className="mx-auto max-w-7xl space-y-4 lg:space-y-6">
        <div className="border-b border-gray-200 pb-4 dark:border-gray-800">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Betrieb</p>
          <h1 className="mt-3 text-3xl font-semibold">System</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Status, Passwortschutz und Datenbank-Backup an einem Ort.
          </p>
        </div>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {statusCards.map((card) => {
            const Icon = card.icon;

            return (
              <article
                key={card.label}
                className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                      {card.label}
                    </p>
                    <p className={`mt-3 text-2xl font-semibold ${card.accent}`}>{card.value}</p>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{card.meta}</p>
                  </div>
                  <span className="rounded-2xl bg-gray-100 p-3 dark:bg-gray-800">
                    <Icon className="h-6 w-6 text-gray-700 dark:text-gray-200" />
                  </span>
                </div>
              </article>
            );
          })}
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <article
              key={metric.label}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                {metric.label}
              </p>
              <p className="mt-3 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {metric.value}
              </p>
            </article>
          ))}
        </section>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-amber-100 p-3 dark:bg-amber-950/40">
                <MdKey className="h-6 w-6 text-amber-700 dark:text-amber-300" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">Passwort ändern</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Beim Ändern werden alle aktuell autorisierten Geräte abgemeldet.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Aktuelles Passwort</span>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) => handlePasswordChange("currentPassword", event.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm outline-none transition focus:border-green-500 dark:border-gray-700 dark:bg-gray-950"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium">Neues Passwort</span>
                <input
                  type="password"
                  value={passwordForm.nextPassword}
                  onChange={(event) => handlePasswordChange("nextPassword", event.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm outline-none transition focus:border-green-500 dark:border-gray-700 dark:bg-gray-950"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium">Neues Passwort bestätigen</span>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) => handlePasswordChange("confirmPassword", event.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm outline-none transition focus:border-green-500 dark:border-gray-700 dark:bg-gray-950"
                />
              </label>
            </div>

            {passwordMessage ? (
              <p className="mt-4 rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                {passwordMessage}
              </p>
            ) : null}

            <button
              type="button"
              onClick={submitPasswordChange}
              disabled={passwordPending}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <MdRefresh className="h-4 w-4" />
              {passwordPending ? "Passwort wird geändert..." : "Passwort ändern"}
            </button>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-blue-100 p-3 dark:bg-blue-950/40">
                <MdDataset className="h-6 w-6 text-blue-700 dark:text-blue-300" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">Datenbank-Backup</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Exportiert die aktuelle Datenbank als ZIP und kann sie vollständig ersetzen.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={downloadBackup}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-800"
              >
                <MdDownload className="h-4 w-4" />
                Backup herunterladen
              </button>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Backup-Datei hochladen</label>
                <input
                  type="file"
                  accept=".zip"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-3 text-sm dark:border-gray-700 dark:bg-gray-950"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Unterstützt wird aktuell Wiederherstellen mit Ersetzen.
                </p>
              </div>

              <button
                type="button"
                onClick={uploadBackupReplace}
                disabled={restorePending}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <MdUploadFile className="h-4 w-4" />
                {restorePending ? "Backup wird eingespielt..." : "Backup ersetzen"}
              </button>
            </div>

            {restoreMessage ? (
              <p className="mt-4 rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                {restoreMessage}
              </p>
            ) : null}
          </section>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-green-100 p-3 dark:bg-green-950/40">
                <MdSystemUpdateAlt className="h-6 w-6 text-green-700 dark:text-green-300" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">Updates</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Prüft GitHub Releases, erstellt vor dem Update ein Backup und startet danach den Dienst neu.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href={GITHUB_REPOSITORY_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-800"
              >
                <MdOpenInNew className="h-4 w-4" />
                GitHub öffnen
              </a>
              <button
                type="button"
                onClick={checkUpdates}
                disabled={updatePending}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-800"
              >
                <MdRefresh className="h-4 w-4" />
                {updatePending ? "Prüfe..." : "Nach Updates suchen"}
              </button>

              <button
                type="button"
                onClick={() => void installUpdate(false)}
                disabled={updatePending || !updateInfo?.updateAvailable}
                className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <MdSystemUpdateAlt className="h-4 w-4" />
                Update installieren
              </button>
              <button
                type="button"
                onClick={() => void installUpdate(true)}
                disabled={updatePending || !updateInfo?.latestTag}
                className="inline-flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-800 shadow-sm transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200 dark:hover:bg-green-950"
              >
                <MdSystemUpdateAlt className="h-4 w-4" />
                Neu anwenden
              </button>
            </div>
          </div>

          {showUpdateProgress || updateStatus ? (
            <div className="mt-5 rounded-2xl border border-green-100 bg-green-50 p-4 dark:border-green-900/60 dark:bg-green-950/30">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                    {updateStatus?.state === "completed"
                      ? "Update abgeschlossen"
                      : updateStatus?.state === "failed"
                        ? "Update fehlgeschlagen"
                        : "Update läuft"}
                  </p>
                  <p className="mt-1 text-sm text-green-800/80 dark:text-green-200/80">
                    {updateStatus?.message ?? "Update wird vorbereitet."}
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-green-800 shadow-sm dark:bg-green-900 dark:text-green-100">
                  {updateProgress}%
                </span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white shadow-inner dark:bg-green-900/70">
                <div
                  className={`h-full rounded-full transition-all ${
                    updateStatus?.state === "failed" ? "bg-red-500" : "bg-green-600"
                  }`}
                  style={{ width: `${updateStatus?.state === "failed" ? 100 : updateProgress}%` }}
                />
              </div>
              {updateStatus?.logTail?.length ? (
                <details className="mt-3 text-xs text-green-900 dark:text-green-100">
                  <summary className="cursor-pointer font-medium">Update-Log anzeigen</summary>
                  <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-white p-3 text-[11px] leading-relaxed text-gray-700 dark:bg-gray-950 dark:text-gray-200">
                    {updateStatus.logTail.join("\n")}
                  </pre>
                </details>
              ) : null}
            </div>
          ) : null}

          <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Installiert</dt>
              <dd className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                v{updateInfo?.currentVersion ?? status.appVersion}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Neueste Version</dt>
              <dd className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                {updateInfo?.latestTag ?? "Noch nicht geprüft"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Repository</dt>
              <dd className="mt-1 break-all text-sm text-gray-700 dark:text-gray-200">
                {updateInfo?.repository ?? "Nicht konfiguriert"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Status</dt>
              <dd className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                {updateInfo?.updateAvailable
                  ? "Update verfügbar"
                  : updateInfo
                    ? "Aktuell"
                    : "Bereit zur Prüfung"}
              </dd>
            </div>
          </dl>

          {updateInfo?.releaseUrl ? (
            <a
              href={updateInfo.releaseUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex text-sm font-medium text-green-700 hover:text-green-800 dark:text-green-300"
            >
              Release auf GitHub öffnen
            </a>
          ) : null}

          {updateMessage ? (
            <p className="mt-4 rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">
              {updateMessage}
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-red-100 p-3 dark:bg-red-950/40">
                <MdSecurity className="h-6 w-6 text-red-700 dark:text-red-300" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">Datenintegritaet</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Prueft defekte Beziehungen und hilft beim Reparieren problematischer Eintraege.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={checkIntegrity}
                disabled={integrityPending}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-800"
              >
                <MdRefresh className="h-4 w-4" />
                {integrityPending ? "Pruefe..." : "Integritaet pruefen"}
              </button>
              <button
                type="button"
                onClick={repairAllSafeIssues}
                disabled={integrityPending || !integrityReport || integrityReport.repairableCount === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Sichere Reparaturen anwenden
              </button>
            </div>
          </div>

          {integrityMessage ? (
            <p className="mt-4 rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">
              {integrityMessage}
            </p>
          ) : null}

          {integrityReport ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-gray-800/70">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Gefunden</p>
                  <p className="mt-2 text-2xl font-semibold">{integrityReport.issueCount}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-gray-800/70">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Reparierbar</p>
                  <p className="mt-2 text-2xl font-semibold">{integrityReport.repairableCount}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-gray-800/70">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Geprueft</p>
                  <p className="mt-2 text-sm font-medium">
                    {new Date(integrityReport.checkedAt).toLocaleString("de-DE")}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {integrityReport.issues.length > 0 ? (
                  integrityReport.issues.map((issue) => (
                    <article
                      key={issue.id}
                      className={`rounded-2xl border p-4 shadow-sm ${
                        issue.severity === "error"
                          ? "border-red-200 bg-red-50 dark:border-red-950 dark:bg-red-950/20"
                          : "border-amber-200 bg-amber-50 dark:border-amber-950 dark:bg-amber-950/20"
                      }`}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                            {issue.entityType} | {issue.severity}
                          </p>
                          <h3 className="mt-2 text-lg font-semibold">{issue.title}</h3>
                          <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">
                            {issue.description}
                          </p>
                          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            ID: {issue.entityId}
                          </p>
                        </div>

                        <div className="flex min-w-[16rem] flex-col gap-2">
                          {issue.repairMode === "reassign_item_location" ? (
                            <select
                              value={repairTargets[issue.id] ?? ""}
                              onChange={(event) =>
                                setRepairTargets((current) => ({
                                  ...current,
                                  [issue.id]: event.target.value,
                                }))
                              }
                              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-950"
                            >
                              <option value="">Ziel-Location waehlen</option>
                              {integrityReport.locations.map((location) => (
                                <option key={location.id} value={location.id}>
                                  {location.name}
                                </option>
                              ))}
                            </select>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => void repairIssue(issue.id)}
                            disabled={
                              integrityPending ||
                              issue.repairMode === "none" ||
                              (issue.repairMode === "reassign_item_location" && !repairTargets[issue.id])
                            }
                            className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                          >
                            {issue.repairMode === "none" ? "Manuell pruefen" : "Defekt reparieren"}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="rounded-2xl bg-green-50 px-4 py-4 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">
                    Keine defekten Eintraege gefunden.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold">Systemdetails</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Konfigurationsquelle</dt>
              <dd className="mt-1 text-sm text-gray-700 dark:text-gray-200">{status.authSource}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Konfigurationspfad</dt>
              <dd className="mt-1 break-all text-sm text-gray-700 dark:text-gray-200">{status.authConfigPath}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Letzte Prüfung</dt>
              <dd className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                {new Date(status.lastCheckedAt).toLocaleString("de-DE")}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Backup-Modus</dt>
              <dd className="mt-1 text-sm text-gray-700 dark:text-gray-200">Datenbank als ZIP, Restore nur Ersetzen</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
