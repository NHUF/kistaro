/* eslint-disable @next/next/no-img-element */

import type { Metadata } from "next";
import { hasDeviceAuthConfig } from "@/lib/device-auth";

export const metadata: Metadata = {
  title: "Freigabe | Kistaro",
  description: "Passwortfreigabe für Kistaro",
};

function getMessage(error: string | undefined, configured: boolean) {
  if (!configured) {
    return "Passwortschutz ist noch nicht konfiguriert. Setze INVENTORY_APP_PASSWORD und INVENTORY_APP_SECRET am Server.";
  }

  if (error === "invalid") {
    return "Das Passwort war nicht korrekt.";
  }

  if (error === "logged_out") {
    return "Dieses Gerät wurde abgemeldet.";
  }

  if (error === "password_changed") {
    return "Das Passwort wurde geändert. Bitte dieses Gerät mit dem neuen Passwort erneut freischalten.";
  }

  return "Bitte Passwort eingeben, um dieses Gerät freizuschalten.";
}

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; message?: string }>;
}) {
  const params = await searchParams;
  const configured = hasDeviceAuthConfig();
  const message = getMessage(params.error ?? params.message, configured);

  return (
    <div className="min-h-screen bg-[#eef3ea] px-4 py-10 text-gray-800">
      <div className="mx-auto max-w-md rounded-[2rem] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <img
            src="/api/app-logo/512"
            alt="Kistaro Logo"
            className="h-12 w-12 rounded-2xl object-contain"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Freigabe</p>
            <h1 className="mt-1 text-3xl font-semibold">Kistaro entsperren</h1>
          </div>
        </div>
        <p className="mt-3 text-sm text-gray-500">{message}</p>

        <form action="/auth/unlock" method="post" className="mt-6 space-y-4">
          <input type="hidden" name="next" value={params.next ?? "/"} />
          <div className="space-y-1">
            <label htmlFor="inventory-password" className="text-sm font-medium text-gray-700">
              Passwort
            </label>
            <input
              id="inventory-password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-md border bg-white px-3 py-2"
              disabled={!configured}
            />
          </div>
          <button
            type="submit"
            disabled={!configured}
            className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Gerät freischalten
          </button>
        </form>
      </div>
    </div>
  );
}
