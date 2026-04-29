import { randomBytes } from "node:crypto";
import { readSystemConfig, writeSystemConfig } from "@/lib/system-config";

const AUTH_COOKIE_NAME = "inventory_device_auth";
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

function getResolvedConfig() {
  const fileConfig = readSystemConfig();

  return {
    password: fileConfig.appPassword?.trim() || process.env.INVENTORY_APP_PASSWORD?.trim() || "",
    secret: fileConfig.appSecret?.trim() || process.env.INVENTORY_APP_SECRET?.trim() || "",
  };
}

function getPassword() {
  return getResolvedConfig().password;
}

function getSecret() {
  return getResolvedConfig().secret;
}

function toBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let output = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const byteOne = bytes[index] ?? 0;
    const byteTwo = bytes[index + 1] ?? 0;
    const byteThree = bytes[index + 2] ?? 0;
    const combined = (byteOne << 16) | (byteTwo << 8) | byteThree;

    output += alphabet[(combined >> 18) & 63];
    output += alphabet[(combined >> 12) & 63];

    if (index + 1 < bytes.length) {
      output += alphabet[(combined >> 6) & 63];
    }

    if (index + 2 < bytes.length) {
      output += alphabet[combined & 63];
    }
  }

  return output;
}

async function sha256(input: string) {
  const bytes = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return toBase64Url(digest);
}

export function hasDeviceAuthConfig() {
  return Boolean(getPassword() && getSecret());
}

export async function isPasswordValid(candidate: string) {
  const expectedPassword = getPassword();

  if (!expectedPassword) {
    return false;
  }

  const [candidateHash, expectedHash] = await Promise.all([
    sha256(`inventory-password:${candidate}`),
    sha256(`inventory-password:${expectedPassword}`),
  ]);

  return candidateHash === expectedHash;
}

export async function getDeviceAuthToken() {
  const secret = getSecret();

  if (!secret) {
    return null;
  }

  return sha256(`inventory-device:${secret}`);
}

export async function changeDevicePassword(currentPassword: string, nextPassword: string) {
  const trimmedPassword = nextPassword.trim();

  if (trimmedPassword.length < 6) {
    return { ok: false as const, error: "Das neue Passwort muss mindestens 6 Zeichen lang sein." };
  }

  const valid = await isPasswordValid(currentPassword);

  if (!valid) {
    return { ok: false as const, error: "Das aktuelle Passwort ist nicht korrekt." };
  }

  writeSystemConfig({
    appPassword: trimmedPassword,
    appSecret: randomBytes(32).toString("base64url"),
  });

  return { ok: true as const };
}

export function getDeviceAuthCookieName() {
  return AUTH_COOKIE_NAME;
}

export function getDeviceAuthCookieMaxAge() {
  return AUTH_COOKIE_MAX_AGE;
}

export function getSafeRedirectPath(candidate: string | null | undefined) {
  if (!candidate) {
    return "/";
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return "/";
  }

  return candidate;
}
