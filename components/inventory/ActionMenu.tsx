"use client";

import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { MdSettings } from "react-icons/md";

export function ActionMenu({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function close() {
      setOpen(false);
    }

    if (open) {
      window.addEventListener("click", close);
    }

    return () => window.removeEventListener("click", close);
  }, [open]);

  function toggle(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setOpen((current) => !current);
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={label}
        onClick={toggle}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
      >
        <MdSettings className="h-5 w-5" aria-hidden="true" />
      </button>

      {open ? (
        <div
          onClick={(event) => event.stopPropagation()}
          className="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function ActionMenuButton({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${className}`}
    >
      {children}
    </button>
  );
}
