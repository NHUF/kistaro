import { NextResponse } from "next/server";
import {
  changeDevicePassword,
  getDeviceAuthCookieName,
} from "@/lib/device-auth";
import { logSystemActivity } from "@/lib/system-activity";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    currentPassword?: string;
    nextPassword?: string;
    confirmPassword?: string;
  };

  const currentPassword = body.currentPassword?.trim() ?? "";
  const nextPassword = body.nextPassword?.trim() ?? "";
  const confirmPassword = body.confirmPassword?.trim() ?? "";

  if (!currentPassword || !nextPassword || !confirmPassword) {
    return NextResponse.json(
      { error: "Bitte alle Passwortfelder ausfüllen." },
      { status: 400 },
    );
  }

  if (nextPassword !== confirmPassword) {
    return NextResponse.json(
      { error: "Die neuen Passwörter stimmen nicht überein." },
      { status: 400 },
    );
  }

  const result = await changeDevicePassword(currentPassword, nextPassword);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await logSystemActivity({
    title: "System-Passwort geändert",
    description: "Das Gerätepasswort wurde geändert und alle Geräte wurden abgemeldet.",
  });

  const response = NextResponse.json({
    success: true,
    message: "Passwort geändert. Alle Geräte wurden abgemeldet.",
  });

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
