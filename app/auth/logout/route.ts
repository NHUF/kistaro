import { NextResponse } from "next/server";
import { getDeviceAuthCookieName } from "@/lib/device-auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/unlock?error=logged_out", request.url), 303);

  response.cookies.set({
    name: getDeviceAuthCookieName(),
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: 0,
  });

  return response;
}
