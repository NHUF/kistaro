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

type GitHubTagResponse = {
  name?: string;
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

function getRepositoryWebUrl(repository: string) {
  return `https://github.com/${repository}`;
}

function getTagReleaseUrl(repository: string, tag: string) {
  return `${getRepositoryWebUrl(repository)}/releases/tag/${tag}`;
}

function getTagTarballUrl(repository: string, tag: string) {
  return `${getRepositoryWebUrl(repository)}/archive/refs/tags/${tag}.tar.gz`;
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

function createErrorResult(
  repository: string,
  currentVersion: string,
  error: string,
): UpdateCheckResult {
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
    error,
  };
}

function createSuccessResult({
  currentVersion,
  latestTag,
  releaseUrl,
  repository,
  tarballUrl,
}: {
  currentVersion: string;
  latestTag: string;
  releaseUrl: string | null;
  repository: string;
  tarballUrl: string | null;
}): UpdateCheckResult {
  const latestVersion = normalizeVersion(latestTag);

  return {
    configured: true,
    repository,
    currentVersion,
    latestVersion,
    latestTag,
    updateAvailable: isNewerVersion(latestVersion, currentVersion),
    releaseUrl,
    tarballUrl,
    checkedAt: new Date().toISOString(),
    updateStatus: readUpdateStatus(),
  };
}

function getGitHubHeaders() {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "kistaro-update-check",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.INVENTORY_UPDATE_TOKEN?.trim();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function getGitHubErrorMessage(response: Response) {
  const remaining = response.headers.get("x-ratelimit-remaining");
  const reset = response.headers.get("x-ratelimit-reset");

  if (response.status === 403 && remaining === "0") {
    const resetDate = reset ? new Date(Number(reset) * 1000).toLocaleString("de-DE") : "später";
    return `GitHub API Rate-Limit erreicht. Nächster Versuch möglich ab ${resetDate}.`;
  }

  try {
    const body = (await response.json()) as { message?: string };
    return body.message ? `GitHub konnte nicht abgefragt werden (${response.status}): ${body.message}` : null;
  } catch {
    return `GitHub konnte nicht abgefragt werden (${response.status}).`;
  }
}

async function checkLatestRelease(repository: string, currentVersion: string) {
  const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
    headers: getGitHubHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      result: null,
      error: await getGitHubErrorMessage(response),
    };
  }

  const release = (await response.json()) as GitHubReleaseResponse;
  const latestTag = release.tag_name ?? null;

  if (!latestTag) {
    return {
      result: null,
      error: "Das neueste GitHub Release enthält keinen Tag.",
    };
  }

  return {
    result: createSuccessResult({
      currentVersion,
      latestTag,
      releaseUrl: release.html_url ?? getTagReleaseUrl(repository, latestTag),
      repository,
      tarballUrl: release.tarball_url ?? getTagTarballUrl(repository, latestTag),
    }),
    error: null,
  };
}

async function checkLatestTagFromApi(repository: string, currentVersion: string) {
  const response = await fetch(`https://api.github.com/repos/${repository}/tags?per_page=50`, {
    headers: getGitHubHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      result: null,
      error: await getGitHubErrorMessage(response),
    };
  }

  const tags = ((await response.json()) as GitHubTagResponse[]).filter((tag) => tag.name);
  const latestTag = tags
    .map((tag) => tag.name as string)
    .sort((a, b) => (isNewerVersion(a, b) ? -1 : isNewerVersion(b, a) ? 1 : 0))[0];

  if (!latestTag) {
    return {
      result: null,
      error: "Es wurde kein GitHub Tag gefunden.",
    };
  }

  const tagRecord = tags.find((tag) => tag.name === latestTag);

  return {
    result: createSuccessResult({
      currentVersion,
      latestTag,
      releaseUrl: getTagReleaseUrl(repository, latestTag),
      repository,
      tarballUrl: tagRecord?.tarball_url ?? getTagTarballUrl(repository, latestTag),
    }),
    error: null,
  };
}

async function checkLatestTagFromWeb(repository: string, currentVersion: string) {
  const response = await fetch(`${getRepositoryWebUrl(repository)}/tags`, {
    headers: {
      Accept: "text/html",
      "User-Agent": "kistaro-update-check",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      result: null,
      error: `GitHub Tags-Seite konnte nicht abgefragt werden (${response.status}).`,
    };
  }

  const html = await response.text();
  const tagPattern = new RegExp(`${repository.replace("/", "\\/")}\\/releases\\/tag\\/([^"?#/]+)`, "g");
  const tags = Array.from(html.matchAll(tagPattern))
    .map((match) => decodeURIComponent(match[1]))
    .filter((tag, index, list) => list.indexOf(tag) === index);
  const latestTag = tags.sort((a, b) => (isNewerVersion(a, b) ? -1 : isNewerVersion(b, a) ? 1 : 0))[0];

  if (!latestTag) {
    return {
      result: null,
      error: "Auf der GitHub Tags-Seite wurde kein Versionstag gefunden.",
    };
  }

  return {
    result: createSuccessResult({
      currentVersion,
      latestTag,
      releaseUrl: getTagReleaseUrl(repository, latestTag),
      repository,
      tarballUrl: getTagTarballUrl(repository, latestTag),
    }),
    error: null,
  };
}

export async function checkForInventoryUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = getCurrentAppVersion();
  const repository = getUpdateRepository();

  if (!repository) {
    return createNotConfiguredResult(currentVersion);
  }

  try {
    const releaseCheck = await checkLatestRelease(repository, currentVersion);

    if (releaseCheck.result) {
      return releaseCheck.result;
    }

    const tagApiCheck = await checkLatestTagFromApi(repository, currentVersion);

    if (tagApiCheck.result) {
      return tagApiCheck.result;
    }

    const tagWebCheck = await checkLatestTagFromWeb(repository, currentVersion);

    if (tagWebCheck.result) {
      return tagWebCheck.result;
    }

    return createErrorResult(
      repository,
      currentVersion,
      tagWebCheck.error ?? tagApiCheck.error ?? releaseCheck.error ?? "Update-Prüfung ist fehlgeschlagen.",
    );
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
