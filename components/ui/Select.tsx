"use client";

import type { ReactNode, SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
};

export function Select({ children, className = "", ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={`w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-gray-900 outline-none transition focus:border-green-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 ${className}`}
    >
      {children}
    </select>
  );
}
