import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type SystemConfig = {
  appPassword?: string;
  appSecret?: string;
  updatedAt?: string;
};

const configPath = resolve(process.cwd(), "storage", "system-config.json");

function ensureConfigDirectory() {
  mkdirSync(dirname(configPath), { recursive: true });
}

export function getSystemConfigPath() {
  return configPath;
}

export function readSystemConfig(): SystemConfig {
  if (!existsSync(configPath)) {
    return {};
  }

  try {
    return JSON.parse(readFileSync(configPath, "utf8")) as SystemConfig;
  } catch {
    return {};
  }
}

export function writeSystemConfig(config: SystemConfig) {
  ensureConfigDirectory();
  writeFileSync(
    configPath,
    JSON.stringify(
      {
        ...config,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );
}
