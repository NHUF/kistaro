"use client";

import { useState, useTransition } from "react";
import { MdCloudDone, MdDataset, MdDownload, MdKey, MdOpenInNew, MdOutlineStorage, MdRefresh, MdSecurity, MdSystemUpdateAlt, MdUploadFile } from "react-icons/md";
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [passwordPending, startPasswordTransition] = useTransition();
  const [restorePending, startRestoreTransition] = useTransition();
  const [updatePending, startUpdateTransition] = useTransition();

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

  async function installUpdate() {
    setUpdateMessage(null);

    startUpdateTransition(async () => {
      const response = await fetch("/api/system/update", {
        method: "POST",
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        targetVersion?: string;
      };

      if (!response.ok) {
        setUpdateMessage(result.error ?? "Update konnte nicht gestartet werden.");
        return;
      }

      setUpdateMessage(
        result.message ??
          `Update auf Version ${result.targetVersion ?? "neu"} wurde gestartet.`,
      );
    });
  }

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
                onClick={installUpdate}
                disabled={updatePending || !updateInfo?.updateAvailable}
                className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <MdSystemUpdateAlt className="h-4 w-4" />
                Update installieren
              </button>
            </div>
          </div>

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
