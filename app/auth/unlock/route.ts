import { NextResponse } from "next/server";
import {
  getDeviceAuthCookieMaxAge,
  getDeviceAuthCookieName,
  getDeviceAuthToken,
  getSafeRedirectPath,
  hasDeviceAuthConfig,
  isPasswordValid,
} from "@/lib/device-auth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const next = getSafeRedirectPath(String(formData.get("next") ?? "/"));

  if (!hasDeviceAuthConfig()) {
    return NextResponse.redirect(new URL("/unlock?error=config", request.url), 303);
  }

  const valid = await isPasswordValid(password);

  if (!valid) {
    const invalidUrl = new URL("/unlock", request.url);
    invalidUrl.searchParams.set("error", "invalid");

    if (next !== "/") {
      invalidUrl.searchParams.set("next", next);
    }

    return NextResponse.redirect(invalidUrl, 303);
  }

  const token = await getDeviceAuthToken();
  const response = NextResponse.redirect(new URL(next, request.url), 303);

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
