import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  getDeviceAuthCookieName,
  getDeviceAuthToken,
  getSafeRedirectPath,
  hasDeviceAuthConfig,
} from "@/lib/device-auth";

async function isAuthorized(request: NextRequest) {
  const expectedToken = await getDeviceAuthToken();
  const currentToken = request.cookies.get(getDeviceAuthCookieName())?.value ?? null;

  return Boolean(expectedToken && currentToken && expectedToken === currentToken);
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isUnlockPage = pathname === "/unlock";
  const isAuthRoute = pathname.startsWith("/auth/");

  if (isAuthRoute) {
    return NextResponse.next();
  }

  const configured = hasDeviceAuthConfig();
  const authorized = configured ? await isAuthorized(request) : false;

  if (isUnlockPage) {
    if (authorized) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  if (authorized) {
    return NextResponse.next();
  }

  const unlockUrl = new URL("/unlock", request.url);
  const nextPath = getSafeRedirectPath(`${pathname}${search}`);

  if (nextPath !== "/") {
    unlockUrl.searchParams.set("next", nextPath);
  }

  if (!configured) {
    unlockUrl.searchParams.set("error", "config");
  }

  return NextResponse.redirect(unlockUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
