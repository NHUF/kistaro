"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "default" | "primary" | "danger" | "ghost" | "success";
};

export function Button({
  children,
  variant = "default",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  const base =
    "px-3 py-1 rounded-md text-sm transition font-medium";

  const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
    default:
      "bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600",
    primary:
      "bg-blue-500 text-white hover:bg-blue-600",
    success:
      "bg-green-600 text-white hover:bg-green-700",
    danger:
      "bg-red-500 text-white hover:bg-red-600",
    ghost:
      "text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700",
  };

  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
