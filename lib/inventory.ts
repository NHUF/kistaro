export type LocationType =
  | "undefined"
  | "site"
  | "room"
  | "cabinet"
  | "box"
  | "carton"
  | "drawer";

export type ItemStatus = "in_use" | "stored" | "lost" | "loaned";

export const ICON_NAME_OPTIONS = [
  { value: "MdCategory", label: "Kategorie" },
  { value: "MdLocationOn", label: "Standort" },
  { value: "MdMeetingRoom", label: "Zimmer" },
  { value: "MdCheckroom", label: "Kasten" },
  { value: "MdInventory2", label: "Inventar" },
  { value: "MdArchive", label: "Karton" },
  { value: "MdInbox", label: "Lade" },
  { value: "MdHomeWork", label: "In Verwendung" },
  { value: "MdMoveToInbox", label: "Eingelagert" },
  { value: "MdSearchOff", label: "Verloren" },
  { value: "MdKeyboardDoubleArrowRight", label: "Verborgt" },
  { value: "MdSell", label: "Etikett" },
  { value: "MdLaptopMac", label: "Elektronik" },
  { value: "MdBuild", label: "Werkzeug" },
  { value: "MdChair", label: "Moebel" },
  { value: "MdKitchen", label: "Kueche" },
  { value: "MdBed", label: "Schlafzimmer" },
  { value: "MdChecklist", label: "Liste" },
  { value: "MdFolder", label: "Ordner" },
] as const;

export const LOCATION_TYPE_OPTIONS: Array<{ value: LocationType; label: string }> = [
  { value: "undefined", label: "Undefiniert" },
  { value: "site", label: "Standort (Geografisch)" },
  { value: "room", label: "Zimmer" },
  { value: "cabinet", label: "Kasten" },
  { value: "box", label: "Kiste" },
  { value: "carton", label: "Karton" },
  { value: "drawer", label: "Lade" },
];

export const ITEM_STATUS_OPTIONS: Array<{ value: ItemStatus; label: string }> = [
  { value: "in_use", label: "In Verwendung" },
  { value: "stored", label: "Eingelagert" },
  { value: "lost", label: "Verloren" },
  { value: "loaned", label: "Verborgt" },
];

export function getLocationTypeLabel(value: string | null | undefined) {
  return LOCATION_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value ?? "-";
}

export function getItemStatusLabel(value: string | null | undefined) {
  return ITEM_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value ?? "-";
}

export type Tag = {
  id: string;
  name: string;
};
