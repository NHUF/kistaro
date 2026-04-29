import type { Metadata } from "next";
import { AuthorizedShell } from "@/components/auth/AuthorizedShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kistaro",
  description: "Kistaro - dein lokales Inventarsystem - Ordnung für alles, was zählt.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <AuthorizedShell>{children}</AuthorizedShell>
      </body>
    </html>
  );
}
