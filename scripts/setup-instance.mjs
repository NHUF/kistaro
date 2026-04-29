import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");
const configPath = resolve(projectRoot, "install-config.txt");
const envPath = resolve(projectRoot, ".env.local");

const template = `# Kistaro-Instanz Setup
# Diese Datei wird beim ersten Start erzeugt.
#
# MINDESTENS AUSFÜLLEN / PRÜFEN
# 1. APP_BASE_URL:
#    Die Adresse, unter der du die App später im Browser öffnest.
#    Beispiel im Heimnetz: http://192.168.5.229:3000
# 2. INVENTORY_APP_PASSWORD:
#    Das Passwort, mit dem Geräte einmalig freigeschaltet werden.
# 3. POSTGRES_PASSWORD:
#    Das lokale Datenbank-Passwort. Bitte nicht bei "kistaro" lassen.
#
# Meistens kannst du alles andere so lassen.
# DATABASE_URL darf leer bleiben; sie wird automatisch aus den POSTGRES_*-Werten gebaut.
# SYSTEMD_SERVICE_USER darf leer bleiben; dann läuft der Dienst als root.
# Hinweis: Verwende in Passwörtern vorerst kein einfaches Anführungszeichen: '

APP_NAME=Kistaro
APP_BASE_URL=http://127.0.0.1:3000
APP_BIND_HOST=0.0.0.0
APP_PORT=3000

# Lokale PostgreSQL-Zielkonfiguration
POSTGRES_DB=kistaro
POSTGRES_USER=kistaro
POSTGRES_PASSWORD=
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
DATABASE_URL=
INVENTORY_STORAGE_DIR=storage

# Geräte-Passwortschutz
INVENTORY_APP_PASSWORD=
INVENTORY_APP_SECRET=auto

# Installationsverhalten
AUTO_INSTALL_DEPENDENCIES=true
AUTO_BUILD=true
APPLY_LOCAL_SCHEMA=false

# Linux-/Server-Betrieb
INSTALL_SYSTEM_SERVICE=true
SYSTEMD_SERVICE_NAME=kistaro
SYSTEMD_SERVICE_USER=
AUTO_REBOOT_AFTER_INSTALL=false
NODE_MAJOR=22

# Updates über GitHub Releases
# Beispiel: dein-github-name/kistaro
INVENTORY_UPDATE_REPOSITORY=
# Nur bei privatem Repository nötig. Bei öffentlichen Releases leer lassen.
INVENTORY_UPDATE_TOKEN=
INVENTORY_BACKUP_DIR=storage/backups
`;

function parseConfig(rawText) {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .reduce((accumulator, line) => {
      const separatorIndex = line.indexOf("=");

      if (separatorIndex === -1) {
        return accumulator;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      accumulator[key] = value;
      return accumulator;
    }, {});
}

function normalizeBoolean(value, fallback = false) {
  if (!value) {
    return fallback;
  }

  return ["1", "true", "yes", "ja"].includes(value.toLowerCase());
}

function createSecret() {
  return randomBytes(32).toString("base64url");
}

function encodeConnectionPart(value) {
  return encodeURIComponent(value ?? "");
}

function writeConfigTemplate() {
  writeFileSync(configPath, template, "utf8");
  console.log("");
  console.log("install-config.txt wurde erstellt.");
  console.log("Bitte die Datei ausfüllen und danach denselben Befehl erneut ausführen:");
  console.log("npm run setup:instance");
  console.log("");
}

function buildEnvFile(config) {
  const secret =
    !config.INVENTORY_APP_SECRET || config.INVENTORY_APP_SECRET.toLowerCase() === "auto"
      ? createSecret()
      : config.INVENTORY_APP_SECRET;
  const databaseUrl =
    config.DATABASE_URL ||
    `postgres://${encodeConnectionPart(config.POSTGRES_USER)}:${encodeConnectionPart(config.POSTGRES_PASSWORD)}@${config.POSTGRES_HOST}:${config.POSTGRES_PORT}/${encodeConnectionPart(config.POSTGRES_DB)}`;

  return {
    envText: `# Generiert durch scripts/setup-instance.mjs
NEXT_PUBLIC_APP_BASE_URL=${config.APP_BASE_URL}
DATABASE_URL=${databaseUrl}
POSTGRES_DB=${config.POSTGRES_DB}
POSTGRES_USER=${config.POSTGRES_USER}
POSTGRES_PASSWORD=${config.POSTGRES_PASSWORD}
POSTGRES_HOST=${config.POSTGRES_HOST}
POSTGRES_PORT=${config.POSTGRES_PORT}
INVENTORY_STORAGE_DIR=${config.INVENTORY_STORAGE_DIR || "storage"}
APP_BIND_HOST=${config.APP_BIND_HOST}
APP_PORT=${config.APP_PORT}
INVENTORY_APP_PASSWORD=${config.INVENTORY_APP_PASSWORD}
INVENTORY_APP_SECRET=${secret}
INVENTORY_UPDATE_REPOSITORY=${config.INVENTORY_UPDATE_REPOSITORY || ""}
INVENTORY_UPDATE_TOKEN=${config.INVENTORY_UPDATE_TOKEN || ""}
INVENTORY_BACKUP_DIR=${config.INVENTORY_BACKUP_DIR || "storage/backups"}
`,
    secret,
  };
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(configPath)) {
  writeConfigTemplate();
  process.exit(0);
}

const config = parseConfig(readFileSync(configPath, "utf8"));
const requiredKeys = [
  "APP_BASE_URL",
  "APP_BIND_HOST",
  "APP_PORT",
  "POSTGRES_DB",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "POSTGRES_HOST",
  "POSTGRES_PORT",
  "INVENTORY_APP_PASSWORD",
];

const missingKeys = requiredKeys.filter((key) => !config[key]);

if (missingKeys.length > 0) {
  console.log("");
  console.log("install-config.txt ist noch nicht vollständig.");
  console.log(`Fehlende Werte: ${missingKeys.join(", ")}`);
  console.log(`Bitte Datei ergänzen: ${configPath}`);
  console.log("");
  process.exit(1);
}

mkdirSync(projectRoot, { recursive: true });
const { envText, secret } = buildEnvFile(config);
writeFileSync(envPath, envText, "utf8");

console.log("");
console.log(".env.local wurde geschrieben.");
console.log(`APP_BASE_URL: ${config.APP_BASE_URL}`);
console.log(`APP_BIND_HOST: ${config.APP_BIND_HOST}`);
console.log(`APP_PORT: ${config.APP_PORT}`);
console.log(
  `INVENTORY_APP_SECRET: ${config.INVENTORY_APP_SECRET?.toLowerCase() === "auto" ? "neu generiert" : "aus Konfig übernommen"}`,
);
console.log("");

if (process.env.SETUP_CONFIG_ONLY === "true") {
  process.exit(0);
}

if (normalizeBoolean(config.AUTO_INSTALL_DEPENDENCIES, true)) {
  console.log("Installiere Abhängigkeiten...");
  runCommand("npm", ["install"]);
}

if (normalizeBoolean(config.AUTO_BUILD, true)) {
  console.log("Prüfe Produktions-Build...");
  runCommand("npm", ["run", "build"]);
}

if (normalizeBoolean(config.APPLY_LOCAL_SCHEMA, false)) {
  console.log("Wende lokales PostgreSQL-Schema an...");
  runCommand("npm", ["run", "db:setup"]);
}

console.log("");
console.log("Instanz-Grundsetup abgeschlossen.");
console.log("Nächste Schritte:");
console.log("1. Server starten: npm run start:network");
console.log(`2. Im Browser öffnen: ${config.APP_BASE_URL}`);
console.log("3. Passwort mit INVENTORY_APP_PASSWORD verwenden.");
console.log(`Aktives Secret: ${secret}`);
console.log("");
