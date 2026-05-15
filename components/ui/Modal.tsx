"use client";

import type { ReactNode } from "react";

export function Modal({
  children,
  size = "md",
}: {
  children: ReactNode;
  size?: "md" | "lg";
}) {
  const sizeClass = size === "lg" ? "max-w-3xl" : "max-w-[420px]";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 px-4 py-6">
      <div className="flex min-h-full items-start justify-center md:items-center">
        <div className={`max-h-[calc(100vh-3rem)] w-full ${sizeClass} overflow-y-auto rounded-2xl bg-white p-5 text-gray-900 shadow-xl dark:bg-gray-900 dark:text-gray-100 sm:p-6`}>
        {children}
        </div>
      </div>
    </div>
  );
}
