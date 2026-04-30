import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { resolve } from "node:path";

export type UpdateJobStatus = {
  state: "idle" | "running" | "completed" | "failed";
  targetTag?: string | null;
  message?: string | null;
  progress?: number | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  logTail?: string[];
};

export type UpdateCheckResult = {
  configured: boolean;
  repository: string | null;
  currentVersion: string;
  latestVersion: string | null;
  latestTag: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  tarballUrl: string | null;
  checkedAt: string;
  updateStatus: UpdateJobStatus | null;
  error?: string;
};

type GitHubReleaseResponse = {
  tag_name?: string;
  name?: string;
  html_url?: string;
  tarball_url?: string;
};

export function getCurrentAppVersion() {
  try {
    const packageJson = JSON.parse(
      readFileSync(resolve(/*turbopackIgnore: true*/ process.cwd(), "package.json"), "utf8"),
    ) as { version?: string };

    return packageJson.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function normalizeVersion(version: string | null | undefined) {
  return (version ?? "0.0.0").trim().replace(/^v/i, "");
}

function parseVersion(version: string) {
  return normalizeVersion(version)
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

export function isNewerVersion(candidate: string | null, current: string) {
  if (!candidate) {
    return false;
  }

  const nextParts = parseVersion(candidate);
  const currentParts = parseVersion(current);
  const maxLength = Math.max(nextParts.length, currentParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const nextPart = nextParts[index] ?? 0;
    const currentPart = currentParts[index] ?? 0;

    if (nextPart > currentPart) {
      return true;
    }

    if (nextPart < currentPart) {
      return false;
    }
  }

  return false;
}

function getUpdateRepository() {
  return process.env.INVENTORY_UPDATE_REPOSITORY?.trim() || "NHUF/kistaro";
}

export function getUpdateStatusPath() {
  return resolve(
    /*turbopackIgnore: true*/ process.cwd(),
    process.env.INVENTORY_UPDATE_STATUS_FILE || "storage/update-status.json",
  );
}

function getUpdateLogPath() {
  return resolve(/*turbopackIgnore: true*/ process.cwd(), "update.log");
}

function readLogTail() {
  try {
    if (!existsSync(getUpdateLogPath())) {
      return [];
    }

    return readFileSync(getUpdateLogPath(), "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-20);
  } catch {
    return [];
  }
}

export function readUpdateStatus(): UpdateJobStatus | null {
  try {
    const statusPath = getUpdateStatusPath();

    if (!existsSync(statusPath)) {
      return null;
    }

    const status = JSON.parse(readFileSync(statusPath, "utf8")) as UpdateJobStatus;
    return {
      ...status,
      logTail: readLogTail(),
    };
  } catch {
    return {
      state: "failed",
      message: "Update-Status konnte nicht gelesen werden.",
      progress: null,
      logTail: readLogTail(),
    };
  }
}

export function writeUpdateStatus(status: UpdateJobStatus) {
  const statusPath = getUpdateStatusPath();
  mkdirSync(dirname(statusPath), { recursive: true });
  writeFileSync(statusPath, JSON.stringify(status, null, 2), "utf8");
}

function createNotConfiguredResult(currentVersion: string): UpdateCheckResult {
  return {
    configured: false,
    repository: null,
    currentVersion,
    latestVersion: null,
    latestTag: null,
    updateAvailable: false,
    releaseUrl: null,
    tarballUrl: null,
    checkedAt: new Date().toISOString(),
    updateStatus: readUpdateStatus(),
    error: "INVENTORY_UPDATE_REPOSITORY ist nicht konfiguriert.",
  };
}

export async function checkForInventoryUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = getCurrentAppVersion();
  const repository = getUpdateRepository();

  if (!repository) {
    return createNotConfiguredResult(currentVersion);
  }

  try {
    const headers: HeadersInit = {
      Accept: "application/vnd.github+json",
      "User-Agent": "inventar-ui-update-check",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    const token = process.env.INVENTORY_UPDATE_TOKEN?.trim();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${repository}/releases/latest`,
      {
        headers,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return {
        configured: true,
        repository,
        currentVersion,
        latestVersion: null,
        latestTag: null,
        updateAvailable: false,
        releaseUrl: null,
        tarballUrl: null,
        checkedAt: new Date().toISOString(),
        updateStatus: readUpdateStatus(),
        error: `GitHub konnte nicht abgefragt werden (${response.status}).`,
      };
    }

    const release = (await response.json()) as GitHubReleaseResponse;
    const latestTag = release.tag_name ?? null;
    const latestVersion = latestTag ? normalizeVersion(latestTag) : null;

    return {
      configured: true,
      repository,
      currentVersion,
      latestVersion,
      latestTag,
      updateAvailable: isNewerVersion(latestVersion, currentVersion),
      releaseUrl: release.html_url ?? null,
      tarballUrl: release.tarball_url ?? null,
      checkedAt: new Date().toISOString(),
      updateStatus: readUpdateStatus(),
    };
  } catch (error) {
    return {
      configured: true,
      repository,
      currentVersion,
      latestVersion: null,
      latestTag: null,
      updateAvailable: false,
      releaseUrl: null,
      tarballUrl: null,
      checkedAt: new Date().toISOString(),
      updateStatus: readUpdateStatus(),
      error:
        error instanceof Error
          ? error.message
          : "Update-Prüfung ist fehlgeschlagen.",
    };
  }
}
