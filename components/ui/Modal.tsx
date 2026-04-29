"use client";

import type { ReactNode } from "react";

export function Modal({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 px-4 py-6">
      <div className="flex min-h-full items-start justify-center md:items-center">
        <div className="max-h-[calc(100vh-3rem)] w-full max-w-[420px] overflow-y-auto rounded-lg bg-white p-6 text-gray-900 shadow-xl dark:bg-gray-900 dark:text-gray-100">
        {children}
        </div>
      </div>
    </div>
  );
}
