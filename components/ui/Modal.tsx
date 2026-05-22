"use client";

import type { ReactNode } from "react";

export function Modal({
  children,
  onClose,
  size = "md",
}: {
  children: ReactNode;
  onClose?: () => void;
  size?: "md" | "lg";
}) {
  const sizeClass = size === "lg" ? "max-w-3xl" : "max-w-[420px]";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 px-4 py-6">
      <div className="flex min-h-full items-start justify-center md:items-center">
        <div className={`relative max-h-[calc(100vh-3rem)] w-full ${sizeClass} overflow-y-auto rounded-2xl bg-white p-5 text-gray-900 shadow-xl dark:bg-gray-900 dark:text-gray-100 sm:p-6`}>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Dialog schließen"
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-xl leading-none text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            >
              ×
            </button>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}
