"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  MdArrowDropDown,
  MdDashboard,
  MdFolderOpen,
  MdInventory2,
  MdLabel,
  MdLibraryBooks,
  MdListAlt,
  MdLogout,
  MdManageSearch,
  MdSettings,
} from "react-icons/md";
import type { ReactNode } from "react";

const LOGO_PATH = "/kistaro-logo.png";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: MdDashboard },
  { href: "/search", label: "Suche", icon: MdManageSearch },
  { href: "/locations", label: "Locations", icon: MdFolderOpen },
  { href: "/items", label: "Items", icon: MdInventory2 },
  { href: "/tags", label: "Tags", icon: MdLabel },
  { href: "/templates", label: "Vorlagen", icon: MdLibraryBooks },
  { href: "/log", label: "Log", icon: MdListAlt },
  { href: "/system", label: "System", icon: MdSettings },
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AuthorizedShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const showLogout = pathname !== "/unlock";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const activeNavItem = useMemo(
    () => NAV_ITEMS.find((item) => isActive(pathname, item.href)) ?? NAV_ITEMS[0],
    [pathname]
  );

  if (!showLogout) {
    return <>{children}</>;
  }

  const logo = (
    <div className="flex items-center gap-3">
      <img
        src={LOGO_PATH}
        alt=""
        aria-hidden="true"
        className="h-10 w-10 rounded-xl object-contain"
      />
      <h1 className="text-3xl font-semibold uppercase tracking-[0.08em] text-gray-900 dark:text-gray-100">
        Kistaro
      </h1>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#eef3ea] dark:bg-gray-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-gray-200 bg-white px-5 py-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:flex lg:flex-col">
        <div className="border-b border-gray-200 pb-5 dark:border-gray-800">
          {logo}
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">Navigation</p>
        </div>

        <nav className="mt-5 flex-1 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <form action="/auth/logout" method="post" className="pt-5">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 shadow-sm transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <MdLogout className="h-4 w-4" />
            <span>Abmelden</span>
          </button>
        </form>
      </aside>

      <div className="lg:pl-64">
        <div className="sticky top-0 z-20 border-b border-gray-200 bg-[#eef3ea]/95 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95 lg:hidden">
          <div className="px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="[&_h1]:text-2xl">{logo}</div>
              </div>
              <form action="/auth/logout" method="post">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white p-2 text-gray-600 shadow-sm transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  aria-label="Abmelden"
                >
                  <MdLogout className="h-4 w-4" />
                </button>
              </form>
            </div>

            <div className="relative mt-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen((current) => !current)}
                className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <span className="flex items-center gap-3">
                  <activeNavItem.icon className="h-5 w-5" />
                  <span>{activeNavItem.label}</span>
                </span>
                <MdArrowDropDown
                  className={`h-5 w-5 transition ${mobileNavOpen ? "rotate-180" : ""}`}
                />
              </button>

              {mobileNavOpen ? (
                <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                  <nav className="space-y-1">
                    {NAV_ITEMS.map((item) => {
                      const active = isActive(pathname, item.href);
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileNavOpen(false)}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                            active
                              ? "bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300"
                              : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="min-h-screen">{children}</div>
      </div>
    </div>
  );
}
