"use client";

import type { ReactNode, SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
};

export function Select({ children, className = "", ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={`w-full rounded-md border bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-700 ${className}`}
    >
      {children}
    </select>
  );
}
