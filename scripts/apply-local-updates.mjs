// Update migrations are intentionally separated from db:setup.
// db:setup is destructive and only belongs to fresh installs/resets.
// Future schema changes should be added here as safe, idempotent migrations.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./load-local-env.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

loadLocalEnv(projectRoot);

console.log("Keine lokalen Update-Migrationen erforderlich.");
