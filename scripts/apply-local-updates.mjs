// Update migrations are intentionally separated from db:setup.
// db:setup is destructive and only belongs to fresh installs/resets.
// Only migrations from this timestamp onward are written to be safe on existing
// local PostgreSQL installations.
import { existsSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./load-local-env.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");
const migrationsDir = resolve(projectRoot, "supabase", "migrations");
const firstSafeMigration = "20260430120000";

loadLocalEnv(projectRoot);

function getDatabaseUrl() {
  const user = encodeURIComponent(process.env.POSTGRES_USER || "kistaro");
  const password = encodeURIComponent(process.env.POSTGRES_PASSWORD || "kistaro");
  const database = encodeURIComponent(process.env.POSTGRES_DB || "kistaro");

  return (
    process.env.DATABASE_URL ||
    `postgres://${user}:${password}@${process.env.POSTGRES_HOST || "127.0.0.1"}:${process.env.POSTGRES_PORT || "5432"}/${database}`
  );
}

function runPsql(filePath) {
  const result = spawnSync(
    "psql",
    ["--dbname", getDatabaseUrl(), "--set", "ON_ERROR_STOP=1", "--file", filePath],
    {
      cwd: projectRoot,
      encoding: "utf8",
      shell: process.platform === "win32",
      stdio: "inherit",
    },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(migrationsDir)) {
  console.error("Migrationsordner nicht gefunden.");
  process.exit(1);
}

const migrationFiles = readdirSync(migrationsDir)
  .filter((fileName) => fileName.endsWith(".sql"))
  .filter((fileName) => fileName.slice(0, firstSafeMigration.length) >= firstSafeMigration)
  .sort();

if (migrationFiles.length === 0) {
  console.log("Keine lokalen Update-Migrationen erforderlich.");
  process.exit(0);
}

for (const fileName of migrationFiles) {
  console.log(`Wende Update-Migration an: ${fileName}`);
  runPsql(resolve(migrationsDir, fileName));
}

console.log("Lokale Update-Migrationen wurden angewendet.");
