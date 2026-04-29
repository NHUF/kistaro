"use client";

import type { ReactNode } from "react";

type FloatingCreateButtonProps =
  | {
      ariaLabel: string;
      children?: ReactNode;
      href: string;
      createType?: "item" | "location";
      onClick?: never;
    }
  | {
      ariaLabel: string;
      children?: ReactNode;
      href?: never;
      createType?: "item" | "location";
      onClick: () => void;
    };

export function FloatingCreateButton({
  ariaLabel,
  children = "+",
  href,
  createType = "item",
  onClick,
}: FloatingCreateButtonProps) {
  const className =
    "fixed z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-2xl font-semibold text-white shadow-lg shadow-green-700/20 transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 [bottom:calc(env(safe-area-inset-bottom)+1rem)] [right:calc(env(safe-area-inset-right)+1rem)] lg:[bottom:calc(env(safe-area-inset-bottom)+1.5rem)] lg:[right:calc(env(safe-area-inset-right)+1.5rem)]";

  if (href) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        className={className}
        onClick={() => {
          if (typeof window === "undefined") {
            return;
          }

          const nextUrl = new URL(href, window.location.origin);
          window.sessionStorage.setItem(
            "inventory-create-intent",
            JSON.stringify({
              type: createType,
            })
          );
          window.location.assign(nextUrl.pathname);
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <button type="button" aria-label={ariaLabel} onClick={onClick} className={className}>
      {children}
    </button>
  );
}
