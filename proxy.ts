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

function getExternalUrl(path: string, request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "http";

  if (forwardedHost) {
    return new URL(path, `${forwardedProto}://${forwardedHost}`);
  }

  return new URL(path, request.url);
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
      return NextResponse.redirect(getExternalUrl("/", request));
    }

    return NextResponse.next();
  }

  if (authorized) {
    return NextResponse.next();
  }

  const unlockUrl = getExternalUrl("/unlock", request);
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
