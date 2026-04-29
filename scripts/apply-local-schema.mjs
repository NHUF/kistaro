import { existsSync, readdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");
const migrationsDir = resolve(projectRoot, "supabase", "migrations");
const seedMigration = "20260425160046_seed_sample_apartment_inventory.sql";

function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    `postgres://${process.env.POSTGRES_USER || "kistaro"}:${process.env.POSTGRES_PASSWORD || "kistaro"}@${process.env.POSTGRES_HOST || "127.0.0.1"}:${process.env.POSTGRES_PORT || "5432"}/${process.env.POSTGRES_DB || "kistaro"}`
  );
}

function sanitizeMigration(sql) {
  const lines = sql.split(/\r?\n/);
  const output = [];
  let skipStorageBlock = false;
  let skipTemplateInsertBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();

    if (skipStorageBlock) {
      if (lower === "end $$;" || lower.endsWith(";")) {
        skipStorageBlock = false;
      }
      continue;
    }

    if (skipTemplateInsertBlock) {
      if (lower.endsWith(";")) {
        skipTemplateInsertBlock = false;
      }
      continue;
    }

    if (
      lower.includes("storage.") ||
      lower.startsWith("insert into storage.") ||
      lower.startsWith("create policy") ||
      lower.startsWith("alter policy")
    ) {
      skipStorageBlock = !lower.endsWith(";");
      continue;
    }

    if (
      lower.startsWith("insert into public.inventory_templates") ||
      lower.startsWith("insert into \"public\".\"inventory_templates\"")
    ) {
      skipTemplateInsertBlock = !lower.endsWith(";");
      continue;
    }

    if (
      lower.startsWith("create extension") ||
      lower.startsWith("alter function") && lower.includes(" owner to ") ||
      lower.startsWith("alter table") && lower.includes(" owner to ") ||
      lower.startsWith("grant ") ||
      lower.startsWith("to anon, authenticated, service_role") ||
      lower.startsWith("alter default privileges") ||
      lower.startsWith("alter publication") ||
      lower.includes("supabase_realtime") ||
      lower.includes("pg_catalog.set_config('search_path'")
    ) {
      continue;
    }

    output.push(line);
  }

  return output.join("\n");
}

function runPsql(sqlFile) {
  const result = spawnSync(
    "psql",
    ["--dbname", getDatabaseUrl(), "--set", "ON_ERROR_STOP=1", "--file", sqlFile],
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
  .filter((fileName) => fileName !== seedMigration)
  .sort();

const tempDirectory = mkdtempSync(join(tmpdir(), "kistaro-local-schema-"));
const combinedSqlPath = join(tempDirectory, "local-schema.sql");

try {
  const combinedSql = [
    "drop schema if exists public cascade;",
    "create schema public;",
    "create extension if not exists pgcrypto;",
    "create extension if not exists \"uuid-ossp\";",
    "set search_path to public;",
    ...migrationFiles.map((fileName) => {
      const migrationSql = readFileSync(resolve(migrationsDir, fileName), "utf8");
      return `\n-- migration: ${fileName}\n${sanitizeMigration(migrationSql)}`;
    }),
  ].join("\n\n");

  writeFileSync(combinedSqlPath, combinedSql, "utf8");
  runPsql(combinedSqlPath);
  console.log("Lokales PostgreSQL-Schema wurde angewendet.");
  console.log(`Demo-Datenmigration wurde ausgelassen: ${seedMigration}`);
  console.log("Standard-Vorlagen wurden ausgelassen, die Datenbank startet leer.");
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}
