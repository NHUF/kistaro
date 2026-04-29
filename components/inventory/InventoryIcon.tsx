"use client";

import { createElement, useEffect, useState, type ReactNode } from "react";
import type { IconType } from "react-icons";
import {
  MdArchive,
  MdBed,
  MdBuild,
  MdCategory,
  MdChair,
  MdCheckroom,
  MdChecklist,
  MdFolder,
  MdHomeWork,
  MdInbox,
  MdInventory2,
  MdKeyboardDoubleArrowRight,
  MdKitchen,
  MdLaptopMac,
  MdLocationOn,
  MdMeetingRoom,
  MdMoveToInbox,
  MdQuestionMark,
  MdSearchOff,
  MdSell,
} from "react-icons/md";
import type { ItemStatus, LocationType } from "@/lib/inventory";

type IconProps = {
  className?: string;
};

function iconClassName(base: string, extra?: string) {
  return extra ? `${base} ${extra}` : base;
}

const knownIcons: Record<string, IconType> = {
  MdArchive,
  MdBed,
  MdBuild,
  MdCategory,
  MdChair,
  MdCheckroom,
  MdChecklist,
  MdFolder,
  MdHomeWork,
  MdInbox,
  MdInventory2,
  MdKeyboardDoubleArrowRight,
  MdKitchen,
  MdLaptopMac,
  MdLocationOn,
  MdMeetingRoom,
  MdMoveToInbox,
  MdQuestionMark,
  MdSearchOff,
  MdSell,
};

const locationIcons: Record<string, string> = {
  undefined: "MdCategory",
  site: "MdLocationOn",
  room: "MdMeetingRoom",
  cabinet: "MdCheckroom",
  box: "MdInventory2",
  carton: "MdArchive",
  drawer: "MdInbox",
};

const itemIcons: Record<string, string> = {
  in_use: "MdHomeWork",
  stored: "MdMoveToInbox",
  lost: "MdSearchOff",
  loaned: "MdKeyboardDoubleArrowRight",
};

function prettifyIconName(name: string) {
  return name
    .replace(/^Md/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\bTv\b/g, "TV")
    .replace(/\bUsb\b/g, "USB")
    .replace(/\bGps\b/g, "GPS")
    .trim();
}

export function getMaterialIconLabel(name: string | null | undefined) {
  if (!name) {
    return null;
  }

  return prettifyIconName(name);
}

function LazyMaterialIcon({
  className,
  name,
}: IconProps & {
  name: string;
}) {
  const [dynamicIcon, setDynamicIcon] = useState<IconType | null>(null);

  useEffect(() => {
    let active = true;

    void import("react-icons/md")
      .then((module) => {
        if (!active) {
          return;
        }

        const nextIcon =
          name in module
            ? (module[name as keyof typeof module] as unknown as IconType | undefined) ?? null
            : null;
        setDynamicIcon(() => nextIcon);
      })
      .catch(() => {
        if (active) {
          setDynamicIcon(() => null);
        }
      });

    return () => {
      active = false;
    };
  }, [name]);

  const ResolvedIcon = dynamicIcon ?? MdQuestionMark;

  return <ResolvedIcon className={iconClassName("h-5 w-5 shrink-0", className)} aria-hidden="true" />;
}

export function MaterialIcon({
  className,
  name,
}: IconProps & {
  name: string | null | undefined;
}) {
  const resolvedName = name ?? "";
  const KnownIcon = knownIcons[resolvedName];

  if (KnownIcon) {
    return <KnownIcon className={iconClassName("h-5 w-5 shrink-0", className)} aria-hidden="true" />;
  }

  if (resolvedName) {
    return <LazyMaterialIcon className={className} name={resolvedName} />;
  }

  return <MdQuestionMark className={iconClassName("h-5 w-5 shrink-0", className)} aria-hidden="true" />;
}

export function LocationTypeIcon({
  className,
  iconName,
  type,
}: IconProps & {
  type: LocationType | null | undefined;
  iconName?: string | null | undefined;
}) {
  if (iconName) {
    return <MaterialIcon className={className} name={iconName} />;
  }

  const ResolvedIcon = knownIcons[locationIcons[type ?? ""] ?? ""] ?? MdQuestionMark;

  return createElement(ResolvedIcon, {
    className: iconClassName("h-5 w-5 shrink-0", className),
    "aria-hidden": "true",
  });
}

export function ItemStatusIcon({
  className,
  iconName,
  status,
}: IconProps & {
  status: ItemStatus | null | undefined;
  iconName?: string | null | undefined;
}) {
  if (iconName) {
    return <MaterialIcon className={className} name={iconName} />;
  }

  const ResolvedIcon = knownIcons[itemIcons[status ?? ""] ?? ""] ?? MdInventory2;

  return createElement(ResolvedIcon, {
    className: iconClassName("h-5 w-5 shrink-0", className),
    "aria-hidden": "true",
  });
}

export function InventoryIconBadge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={iconClassName(
        "inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-200",
        className
      )}
    >
      {children}
    </span>
  );
}
