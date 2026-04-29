const DEVICE_ID_STORAGE_KEY = "inventory-device-id";

function detectPlatform() {
  const navigatorWithUserAgentData = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platform = navigatorWithUserAgentData.userAgentData?.platform || navigator.platform || "";
  const lower = platform.toLowerCase();

  if (lower.includes("iphone") || lower.includes("ipad") || lower.includes("ios")) {
    return "iPhone/iPad";
  }

  if (lower.includes("android")) {
    return "Android";
  }

  if (lower.includes("mac")) {
    return "Mac";
  }

  if (lower.includes("win")) {
    return "Windows";
  }

  if (lower.includes("linux")) {
    return "Linux";
  }

  return "Gerät";
}

function detectBrowser() {
  const agent = navigator.userAgent.toLowerCase();

  if (agent.includes("edg/")) {
    return "Edge";
  }

  if (agent.includes("firefox/")) {
    return "Firefox";
  }

  if (agent.includes("samsungbrowser/")) {
    return "Samsung Internet";
  }

  if (agent.includes("chrome/") && !agent.includes("edg/")) {
    return "Chrome";
  }

  if (agent.includes("safari/") && !agent.includes("chrome/")) {
    return "Safari";
  }

  return "Browser";
}

function createFallbackId() {
  const random = Math.random().toString(36).slice(2, 8);
  const timestamp = Date.now().toString(36).slice(-4);

  return `${timestamp}${random}`.toUpperCase();
}

function getPersistentDeviceId() {
  const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);

  if (existing) {
    return existing;
  }

  const nextId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8).toUpperCase()
      : createFallbackId();

  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, nextId);
  return nextId;
}

export function getDeviceActorLabel() {
  if (typeof window === "undefined") {
    return "Unbekanntes Gerät";
  }

  return `${detectPlatform()} · ${detectBrowser()} · ${getPersistentDeviceId()}`;
}
