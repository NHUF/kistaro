import { NextResponse } from "next/server";
import {
  getDeviceAuthCookieMaxAge,
  getDeviceAuthCookieName,
  getDeviceAuthToken,
  getSafeRedirectPath,
  hasDeviceAuthConfig,
  isPasswordValid,
} from "@/lib/device-auth";

function getExternalUrl(path: string, request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "http";

  if (forwardedHost) {
    return new URL(path, `${forwardedProto}://${forwardedHost}`);
  }

  if (process.env.NEXT_PUBLIC_APP_BASE_URL) {
    return new URL(path, process.env.NEXT_PUBLIC_APP_BASE_URL);
  }

  return new URL(path, request.url);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const next = getSafeRedirectPath(String(formData.get("next") ?? "/"));

  if (!hasDeviceAuthConfig()) {
    return NextResponse.redirect(getExternalUrl("/unlock?error=config", request), 303);
  }

  const valid = await isPasswordValid(password);

  if (!valid) {
    const invalidUrl = getExternalUrl("/unlock", request);
    invalidUrl.searchParams.set("error", "invalid");

    if (next !== "/") {
      invalidUrl.searchParams.set("next", next);
    }

    return NextResponse.redirect(invalidUrl, 303);
  }

  const token = await getDeviceAuthToken();
  const response = NextResponse.redirect(getExternalUrl(next, request), 303);

  response.cookies.set({
    name: getDeviceAuthCookieName(),
    value: token ?? "",
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: getDeviceAuthCookieMaxAge(),
  });

  return response;
}
