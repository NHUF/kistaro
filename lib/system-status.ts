import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasDeviceAuthConfig } from "@/lib/device-auth";
import { checkDatabaseConnection, queryOne } from "@/lib/db";
import { getStorageRoot } from "@/lib/local-file-storage";
import { getSystemConfigPath, readSystemConfig } from "@/lib/system-config";

export type SystemStatusData = {
  appVersion: string;
  runtime: string;
  authConfigured: boolean;
  authConfigPath: string;
  authSource: "datei" | "umgebung" | "unbekannt";
  databaseConnected: boolean;
  databaseLabel: string;
  storageLabel: string;
  itemCount: number;
  locationCount: number;
  tagCount: number;
  templateCount: number;
  lastCheckedAt: string;
};

function readAppVersion() {
  try {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    ) as { version?: string };

    return packageJson.version ?? "unbekannt";
  } catch {
    return "unbekannt";
  }
}

async function countTable(tableName: string) {
  const row = await queryOne<{ count: string }>(
    `select count(*)::text as count from public."${tableName}"`,
  );

  return row ? Number(row.count) : 0;
}

export async function fetchSystemStatusData(): Promise<SystemStatusData> {
  const fileConfig = readSystemConfig();
  let databaseConnected = false;
  let itemCount = 0;
  let locationCount = 0;
  let tagCount = 0;
  let templateCount = 0;

  try {
    await checkDatabaseConnection();
    [itemCount, locationCount, tagCount, templateCount] = await Promise.all([
      countTable("items"),
      countTable("locations"),
      countTable("tags"),
      countTable("inventory_templates"),
    ]);
    databaseConnected = true;
  } catch {
    databaseConnected = false;
  }

  return {
    appVersion: readAppVersion(),
    runtime: `Node ${process.versions.node}`,
    authConfigured: hasDeviceAuthConfig(),
    authConfigPath: getSystemConfigPath(),
    authSource:
      fileConfig.appPassword || fileConfig.appSecret
        ? "datei"
        : process.env.INVENTORY_APP_PASSWORD || process.env.INVENTORY_APP_SECRET
          ? "umgebung"
          : "unbekannt",
    databaseConnected,
    databaseLabel: "Lokale PostgreSQL-Datenbank",
    storageLabel: `Lokales Dateisystem: ${getStorageRoot()}`,
    itemCount,
    locationCount,
    tagCount,
    templateCount,
    lastCheckedAt: new Date().toISOString(),
  };
}
