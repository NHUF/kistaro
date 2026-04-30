import type { Metadata } from "next";
import { AuthorizedShell } from "@/components/auth/AuthorizedShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kistaro",
  description: "Kistaro - dein lokales Inventarsystem - Ordnung für alles, was zählt.",
  icons: {
    icon: [
      { url: "/api/app-logo/512", sizes: "512x512", type: "image/png" },
      { url: "/api/app-logo/48", sizes: "48x48", type: "image/png" },
      { url: "/api/app-logo/32", sizes: "32x32", type: "image/png" },
      { url: "/api/app-logo/16", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/api/app-logo/512", sizes: "512x512", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthorizedShell>{children}</AuthorizedShell>
      </body>
    </html>
  );
}
