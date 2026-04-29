"use client";

import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-700 ${className}`}
    />
  );
}
