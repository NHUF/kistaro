"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { MdExpandMore, MdKeyboardArrowRight, MdSettings } from "react-icons/md";
import { supabase } from "@/lib/supabase";

import { buildTree, flattenTree, getInitialSelectedLocation } from "@/components/inventory/dashboard-utils";
import type {
  DashboardItem as Item,
  DashboardLocation as Location,
  DeleteStrategy,
  InventoryTemplate,
  TagUsage,
} from "@/components/inventory/dashboard-types";
import { FloatingCreateButton } from "@/components/inventory/FloatingCreateButton";
import { ImagePicker } from "@/components/inventory/ImagePicker";
import { InventoryImage } from "@/components/inventory/InventoryImage";
import {
  InventoryIconBadge,
  ItemStatusIcon,
  LocationTypeIcon,
  getMaterialIconLabel,
} from "@/components/inventory/InventoryIcon";
import { IconPicker } from "@/components/inventory/IconPicker";
import {
  ResourceLinksEditor,
  normalizeResourceLinkDrafts,
  toResourceLinkDrafts,
  type ResourceLinkDraft,
} from "@/components/inventory/ResourceLinksEditor";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { DashboardData, ResourceLinkRecord } from "@/lib/inventory-data";
import { removeInventoryImage, uploadInventoryImage } from "@/lib/inventory-media";
import { logInventoryActivity } from "@/lib/inventory-activity";
import {
  ITEM_STATUS_OPTIONS,
  LOCATION_TYPE_OPTIONS,
  getItemStatusLabel,
  getLocationTypeLabel,
  type ItemStatus,
  type LocationType,
} from "@/lib/inventory";

type MenuProps = {
  children: ReactNode;
  label: string;
};

type LocationNodeProps = {
  location: Location;
  selected: string | null;
  setSelected: (id: string) => void;
  onMove: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (location: Location) => void;
  expandedLocations: Set<string>;
  onToggleExpanded: (id: string) => void;
  showActions?: boolean;
};

type ItemCardProps = {
  item: Item;
  locationLabel: string;
  onEdit: (item: Item) => void;
  onMove: (id: string) => void;
  onDelete: (id: string) => void;
};

function parseOptionalPrice(value: string, label = "Preis") {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const parsedValue = Number(trimmedValue);

  if (Number.isNaN(parsedValue)) {
    throw new Error(`${label} muss eine gültige Zahl sein.`);
  }

  return parsedValue;
}

function nextNameFromTemplate(templateName: string, existingNames: string[]) {
  const prefix = templateName.replace(/-0000$/, "");
  const nextNumber =
    existingNames
      .filter((name) => name.startsWith(prefix))
      .map((name) => Number(name.slice(-4)))
      .filter((value) => Number.isInteger(value))
      .reduce((max, value) => Math.max(max, value), 0) + 1;

  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
}

function getTemplateName(baseName: string) {
  return `${baseName.trim().replace(/-0000$/, "")}-0000`;
}

function isUnknownLocationValueColumn(errorMessage: string) {
  return errorMessage.includes("location_value") && errorMessage.toLowerCase().includes("column");
}

export function DashboardClient({ initialData }: { initialData: DashboardData }) {
  const handledCreateIntentRef = useRef(false);
  const [locations, setLocations] = useState<Location[]>(initialData.locations as Location[]);
  const [tree, setTree] = useState<Location[]>(buildTree(initialData.locations as Location[]));
  const [items, setItems] = useState<Item[]>(initialData.items as Item[]);
  const [templates, setTemplates] = useState<InventoryTemplate[]>((initialData.templates ?? []) as InventoryTemplate[]);
  const [topTags, setTopTags] = useState<TagUsage[]>(initialData.topTags as TagUsage[]);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(
    getInitialSelectedLocation(initialData.locations as Location[])
  );
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(
    () => new Set((initialData.locations as Location[]).filter((location) => !location.parent_id).map((location) => location.id))
  );
  const [dashboardQuery, setDashboardQuery] = useState("");

  const [moveLocationId, setMoveLocationId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [deleteLocationId, setDeleteLocationId] = useState<string | null>(null);
  const [deleteStrategy, setDeleteStrategy] = useState<DeleteStrategy>("unpack");
  const [editLocation, setEditLocation] = useState<Location | null>(null);
  const [editLocationName, setEditLocationName] = useState("");
  const [editLocationType, setEditLocationType] = useState<LocationType | "">("");
  const [editLocationDescription, setEditLocationDescription] = useState("");
  const [editLocationParent, setEditLocationParent] = useState<string | null>(null);
  const [editLocationValue, setEditLocationValue] = useState("");
  const [editLocationIcon, setEditLocationIcon] = useState("");
  const [editLocationImageFile, setEditLocationImageFile] = useState<File | null>(null);
  const [editLocationRemoveImage, setEditLocationRemoveImage] = useState(false);
  const [editLocationLinks, setEditLocationLinks] = useState<ResourceLinkDraft[]>([]);

  const [editItem, setEditItem] = useState<Item | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemDescription, setEditItemDescription] = useState("");
  const [editItemValue, setEditItemValue] = useState("");
  const [editItemPurchaseDate, setEditItemPurchaseDate] = useState("");
  const [editItemStatus, setEditItemStatus] = useState<ItemStatus | "">("");
  const [editItemLocation, setEditItemLocation] = useState<string | null>(null);
  const [editItemIcon, setEditItemIcon] = useState("");
  const [editItemImageFile, setEditItemImageFile] = useState<File | null>(null);
  const [editItemRemoveImage, setEditItemRemoveImage] = useState(false);
  const [editItemLinks, setEditItemLinks] = useState<ResourceLinkDraft[]>([]);
  const [moveItemId, setMoveItemId] = useState<string | null>(null);
  const [moveItemTarget, setMoveItemTarget] = useState<string | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<"item" | "location">("item");
  const [createTarget, setCreateTarget] = useState<"object" | "template">("object");
  const [createMode, setCreateMode] = useState<"manual" | "template">("manual");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemLocation, setItemLocation] = useState<string | null>(null);
  const [itemStatus, setItemStatus] = useState<ItemStatus | "">("");
  const [itemValue, setItemValue] = useState("");
  const [itemPurchaseDate, setItemPurchaseDate] = useState("");
  const [itemIcon, setItemIcon] = useState("");
  const [itemImageFile, setItemImageFile] = useState<File | null>(null);
  const [itemLinks, setItemLinks] = useState<ResourceLinkDraft[]>([]);
  const [locName, setLocName] = useState("");
  const [locParent, setLocParent] = useState<string | null>(null);
  const [locType, setLocType] = useState<LocationType | "">("");
  const [locDescription, setLocDescription] = useState("");
  const [locValue, setLocValue] = useState("");
  const [locIcon, setLocIcon] = useState("");
  const [locImageFile, setLocImageFile] = useState<File | null>(null);
  const [locLinks, setLocLinks] = useState<ResourceLinkDraft[]>([]);

  useEffect(() => {
    if (handledCreateIntentRef.current) {
      return;
    }

    const storedIntent =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem("inventory-create-intent")
        : null;

    const parsedIntent =
      storedIntent != null
        ? (() => {
            try {
              return JSON.parse(storedIntent) as { type?: "item" | "location" };
            } catch {
              return null;
            }
          })()
        : null;

    if (!parsedIntent) {
      return;
    }

    handledCreateIntentRef.current = true;

    const nextType = parsedIntent?.type === "location" ? "location" : "item";

    const timeoutId = window.setTimeout(() => {
      setCreateOpen(true);
      setCreateType(nextType);
      setCreateTarget("object");
      setCreateMode("manual");
      setSelectedTemplateId("");
      setItemName("");
      setItemDescription("");
      setItemLocation(nextType === "item" ? selectedLocation : null);
      setItemStatus("");
      setItemValue("");
      setItemPurchaseDate("");
      setItemIcon("");
      setItemImageFile(null);
      setItemLinks([]);
      setLocName("");
      setLocParent(nextType === "location" ? selectedLocation : null);
      setLocType("");
      setLocDescription("");
      setLocValue("");
      setLocIcon("");
      setLocImageFile(null);
      setLocLinks([]);

      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("inventory-create-intent");
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [selectedLocation]);

  async function fetchData() {
    const { data: locationData } = await supabase.from<Location[]>("locations").select("*");
    const { data: itemData } = await supabase.from<Item[]>("items").select("*");
    const { data: templateData } = await supabase.from<InventoryTemplate[]>("inventory_templates").select("*").order("name");
    const { data: tagsData } = await supabase.from<Array<{ id: string; name: string }>>("tags").select("id, name").order("name");
    const { data: itemTagsData } = await supabase.from<Array<{ item_id: string; tag_id: string }>>("item_tags").select("item_id, tag_id");
    const { data: locationTagsData } = await supabase.from<Array<{ location_id: string; tag_id: string }>>("location_tags").select("location_id, tag_id");

    const nextLocations = locationData ?? [];
    const nextItems = itemData ?? [];
    const nextTemplates = (templateData ?? []) as InventoryTemplate[];
    const nextTags = (tagsData ?? []) as Array<{ id: string; name: string }>;
    const nextItemTags = (itemTagsData ?? []) as Array<{ item_id: string; tag_id: string }>;
    const nextLocationTags = (locationTagsData ?? []) as Array<{ location_id: string; tag_id: string }>;

    setLocations(nextLocations);
    setItems(nextItems);
    setTemplates(nextTemplates);
    setTree(buildTree(nextLocations));
    setTopTags(
      nextTags
        .map((tag) => ({
          id: tag.id,
          name: tag.name,
          item_count: nextItemTags.filter((entry) => entry.tag_id === tag.id).length,
          location_count: nextLocationTags.filter((entry) => entry.tag_id === tag.id).length,
        }))
        .filter((tag) => tag.item_count > 0 || tag.location_count > 0)
        .sort((a, b) => b.item_count + b.location_count - (a.item_count + a.location_count))
        .slice(0, 8)
    );

    setSelectedLocation((current) => {
      if (!current) {
        const firstRoot = nextLocations.find((location) => !location.parent_id);
        return firstRoot?.id ?? nextLocations[0]?.id ?? null;
      }

      return nextLocations.some((location) => location.id === current)
        ? current
        : nextLocations.find((location) => !location.parent_id)?.id ?? nextLocations[0]?.id ?? null;
    });
    setExpandedLocations((current) => {
      const nextExpanded = new Set(current);

      nextLocations
        .filter((location) => !location.parent_id)
        .forEach((location) => nextExpanded.add(location.id));

      return nextExpanded;
    });
  }

  async function insertTemplate(payload: Partial<InventoryTemplate>) {
    const response = await supabase.from<InventoryTemplate[]>("inventory_templates").insert(payload);

    if (response.error && isUnknownLocationValueColumn(response.error.message)) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.location_value;
      return supabase.from<InventoryTemplate[]>("inventory_templates").insert(fallbackPayload);
    }

    return response;
  }

  async function createResourceLinks(
    entityType: "item" | "location",
    entityId: string | null | undefined,
    linkDrafts: ResourceLinkDraft[],
  ) {
    if (!entityId) {
      return;
    }

    const links = normalizeResourceLinkDrafts(linkDrafts);

    for (const link of links) {
      const { error } = await supabase.rpc("create_resource_link", {
        target_entity_type: entityType,
        target_entity_id: entityId,
        link_label: link.label,
        link_url: link.url,
      });

      if (error) {
        throw new Error(error.message);
      }
    }
  }

  async function loadResourceLinks(entityType: "item" | "location", entityId: string) {
    const { data, error } = await supabase
      .from<ResourceLinkRecord[]>("inventory_resource_links")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at");

    if (error) {
      throw new Error(error.message);
    }

    return toResourceLinkDrafts(data ?? []);
  }

  async function replaceResourceLinks(entityType: "item" | "location", entityId: string, linkDrafts: ResourceLinkDraft[]) {
    const links = normalizeResourceLinkDrafts(linkDrafts);
    const deleteResponse = await supabase
      .from<ResourceLinkRecord[]>("inventory_resource_links")
      .delete()
      .eq("entity_type", entityType)
      .eq("entity_id", entityId);

    if (deleteResponse.error) {
      throw new Error(deleteResponse.error.message);
    }

    if (links.length === 0) {
      return 0;
    }

    const { error } = await supabase.from<ResourceLinkRecord[]>("inventory_resource_links").insert(
      links.map((link) => ({
        entity_type: entityType,
        entity_id: entityId,
        label: link.label,
        url: link.url,
      }))
    );

    if (error) {
      throw new Error(error.message);
    }

    return links.length;
  }

  async function create() {
    if (createMode === "manual" && createTarget === "template") {
      const baseName = createType === "item" ? itemName.trim() : locName.trim();

      if (!baseName) {
        window.alert("Name für die Vorlage ist erforderlich.");
        return;
      }

      let nextItemValue: number | null = null;
      let nextLocationValue: number | null = null;
      let nextLinks: Array<{ label: string; url: string }> = [];

      try {
        nextItemValue = createType === "item" ? parseOptionalPrice(itemValue) : null;
        nextLocationValue = createType === "location" ? parseOptionalPrice(locValue) : null;
        nextLinks = normalizeResourceLinkDrafts(createType === "item" ? itemLinks : locLinks);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Preis muss eine gültige Zahl sein.");
        return;
      }

      let uploadedImagePath: string | null = null;

      try {
        if (createType === "item" && itemImageFile) {
          uploadedImagePath = await uploadInventoryImage(itemImageFile, "items");
        }

        if (createType === "location" && locImageFile) {
          uploadedImagePath = await uploadInventoryImage(locImageFile, "locations");
        }
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Bild konnte nicht hochgeladen werden.");
        return;
      }

      const { error } = await insertTemplate({
        entity_type: createType,
        name: getTemplateName(baseName),
        description: createType === "item" ? itemDescription.trim() || null : locDescription.trim() || null,
        location_type: createType === "location" ? locType || null : null,
        item_status: createType === "item" ? itemStatus || null : null,
        icon_name: createType === "item" ? itemIcon || null : locIcon || null,
        image_path: uploadedImagePath,
        item_value: createType === "item" ? nextItemValue : null,
        item_purchase_date: createType === "item" ? itemPurchaseDate || null : null,
        location_value: createType === "location" ? nextLocationValue : null,
        links: nextLinks,
      });

      if (error) {
        if (uploadedImagePath) {
          await removeInventoryImage(uploadedImagePath);
        }
        window.alert(error.message);
        return;
      }

      await logInventoryActivity({
        action: "create",
        entityType: "template",
        title: `Vorlage erstellt: ${baseName}-0000`,
        description: `${createType === "item" ? "Item" : "Location"}-Vorlage wurde angelegt.`,
      });

      resetCreate();
      await fetchData();
      return;
    }

    if (createMode === "template" && !selectedTemplateId) {
      window.alert("Bitte eine Vorlage wählen.");
      return;
    }

    if (createType === "location") {
      if (!locName.trim()) {
        return;
      }

      let nextLocationValue: number | null = null;
      let nextLinks: Array<{ label: string; url: string }> = [];

      try {
        nextLocationValue = parseOptionalPrice(locValue);
        nextLinks = normalizeResourceLinkDrafts(locLinks);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Preis muss eine gültige Zahl sein.");
        return;
      }

      let uploadedImagePath: string | null = null;
      const templateImagePath = createMode === "template" ? selectedTemplate?.image_path ?? null : null;

      try {
        if (locImageFile) {
          uploadedImagePath = await uploadInventoryImage(locImageFile, "locations");
        }
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Bild konnte nicht hochgeladen werden.");
        return;
      }

      const { data: createdLocationId, error } = await supabase.rpc<string>("create_location", {
        loc_name: locName.trim(),
        loc_type: locType || null,
        parent_location: locParent,
        loc_description: locDescription.trim() || null,
        loc_icon_name: locIcon || null,
        loc_image_path: uploadedImagePath ?? templateImagePath,
        loc_value: nextLocationValue,
      });

      if (error) {
        if (uploadedImagePath) {
          await removeInventoryImage(uploadedImagePath);
        }
        window.alert(error.message);
        return;
      }

      try {
        await createResourceLinks("location", createdLocationId, locLinks);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Links konnten nicht gespeichert werden.");
      }

      await logInventoryActivity({
        action: "create",
        entityType: "location",
        title: `Location erstellt: ${locName.trim()}`,
        description: "Neue Location wurde angelegt.",
        metadata: {
          link_count: nextLinks.length,
          template_id: createMode === "template" ? selectedTemplateId : null,
        },
      });
    }

    if (createType === "item") {
      if (!itemName.trim()) {
        return;
      }

      if (!itemLocation) {
        window.alert("Item braucht eine Location.");
        return;
      }

      let nextItemValue: number | null = null;
      let nextLinks: Array<{ label: string; url: string }> = [];

      try {
        nextItemValue = parseOptionalPrice(itemValue);
        nextLinks = normalizeResourceLinkDrafts(itemLinks);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Preis muss eine gültige Zahl sein.");
        return;
      }

      let uploadedImagePath: string | null = null;
      const templateImagePath = createMode === "template" ? selectedTemplate?.image_path ?? null : null;

      try {
        if (itemImageFile) {
          uploadedImagePath = await uploadInventoryImage(itemImageFile, "items");
        }
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Bild konnte nicht hochgeladen werden.");
        return;
      }

      const { data: createdItemId, error } = await supabase.rpc<string>("create_item", {
        item_name: itemName.trim(),
        target_location: itemLocation,
        item_icon_name: itemIcon || null,
        item_image_path: uploadedImagePath ?? templateImagePath,
        item_description: itemDescription.trim() || null,
        item_value: nextItemValue,
        item_purchase_date: itemPurchaseDate || null,
        item_status: itemStatus || null,
      });

      if (error) {
        if (uploadedImagePath) {
          await removeInventoryImage(uploadedImagePath);
        }
        window.alert(error.message);
        return;
      }

      try {
        await createResourceLinks("item", createdItemId, itemLinks);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Links konnten nicht gespeichert werden.");
      }

      await logInventoryActivity({
        action: "create",
        entityType: "item",
        title: `Item erstellt: ${itemName.trim()}`,
        description: "Neues Item wurde angelegt.",
        metadata: {
          location_id: itemLocation,
          link_count: nextLinks.length,
          template_id: createMode === "template" ? selectedTemplateId : null,
        },
      });
    }

    resetCreate();
    await fetchData();
  }

  async function moveLocation() {
    if (!moveLocationId) {
      return;
    }

    const { error } = await supabase.rpc("move_location", {
      loc_id: moveLocationId,
      new_parent: moveTarget,
    });

    if (error) {
      window.alert(error.message);
      return;
    }

    const movedLocationName = locations.find((location) => location.id === moveLocationId)?.name ?? "Location";
    const targetLocationName = moveTarget ? getLocationName(moveTarget) : "Root";
    await logInventoryActivity({
      action: "move",
      entityId: moveLocationId,
      entityType: "location",
      title: `Location verschoben: ${movedLocationName}`,
      description: `${movedLocationName} wurde nach ${targetLocationName} verschoben.`,
    });

    setMoveLocationId(null);
    setMoveTarget(null);
    await fetchData();
  }

  async function deleteLocation() {
    if (!deleteLocationId) {
      return;
    }

    const { error } = await supabase.rpc("delete_location", {
      loc_id: deleteLocationId,
      strategy: deleteStrategy,
    });

    if (error) {
      window.alert(error.message);
      return;
    }

    const deletedLocationName = locations.find((location) => location.id === deleteLocationId)?.name ?? "Location";
    await logInventoryActivity({
      action: "delete",
      entityId: deleteLocationId,
      entityType: "location",
      title: `Location gelöscht: ${deletedLocationName}`,
      description: `Löschstrategie: ${deleteStrategy}`,
    });

    setDeleteLocationId(null);
    setDeleteStrategy("unpack");
    await fetchData();
  }

  async function updateLocation() {
    if (!editLocation || !editLocationName.trim()) {
      return;
    }

    let nextLocationValue: number | null = null;

    try {
      nextLocationValue = parseOptionalPrice(editLocationValue);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Preis muss eine gültige Zahl sein.");
      return;
    }

    let uploadedImagePath: string | null = null;
    let nextImagePath = editLocationRemoveImage ? null : editLocation.image_path ?? null;

    try {
      if (editLocationImageFile) {
        uploadedImagePath = await uploadInventoryImage(editLocationImageFile, "locations");
        nextImagePath = uploadedImagePath;
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Bild konnte nicht hochgeladen werden.");
      return;
    }

    const { error } = await supabase.rpc("update_location", {
      loc_id: editLocation.id,
      loc_name: editLocationName.trim(),
      loc_type: editLocationType || null,
      parent_location: editLocationParent,
      loc_description: editLocationDescription.trim() || null,
      loc_icon_name: editLocationIcon || null,
      loc_image_path: nextImagePath,
      loc_value: nextLocationValue,
    });

    if (error) {
      if (uploadedImagePath) {
        await removeInventoryImage(uploadedImagePath);
      }
      window.alert(error.message);
      return;
    }

    let nextLinkCount = 0;

    try {
      nextLinkCount = await replaceResourceLinks("location", editLocation.id, editLocationLinks);
    } catch (linkError) {
      window.alert(linkError instanceof Error ? linkError.message : "Links konnten nicht gespeichert werden.");
      return;
    }

    if (
      (editLocationRemoveImage || uploadedImagePath) &&
      editLocation.image_path &&
      editLocation.image_path !== nextImagePath
    ) {
      try {
        await removeInventoryImage(editLocation.image_path);
      } catch (cleanupError) {
        window.alert(
          cleanupError instanceof Error ? cleanupError.message : "Altes Bild konnte nicht entfernt werden."
        );
      }
    }

    setEditLocation(null);
    setEditLocationName("");
    setEditLocationType("");
    setEditLocationDescription("");
    setEditLocationParent(null);
    setEditLocationValue("");
    setEditLocationIcon("");
    setEditLocationImageFile(null);
    setEditLocationRemoveImage(false);
    setEditLocationLinks([]);
    await logInventoryActivity({
      action: editLocation.parent_id !== editLocationParent ? "move" : "update",
      entityId: editLocation.id,
      entityType: "location",
      title: `Location bearbeitet: ${editLocationName.trim()}`,
      description:
        editLocation.parent_id !== editLocationParent
          ? `${editLocationName.trim()} wurde verschoben.`
          : "Location-Details wurden aktualisiert.",
      metadata: {
        link_count: nextLinkCount,
      },
    });
    await fetchData();
  }

  async function updateItem() {
    if (!editItem || !editItemName.trim()) {
      return;
    }

    const nextValue = editItemValue.trim() === "" ? null : Number(editItemValue);

    if (nextValue !== null && Number.isNaN(nextValue)) {
      window.alert("Wert muss eine gültige Zahl sein.");
      return;
    }

    let uploadedImagePath: string | null = null;
    let nextImagePath = editItemRemoveImage ? null : editItem.image_path ?? null;

    try {
      if (editItemImageFile) {
        uploadedImagePath = await uploadInventoryImage(editItemImageFile, "items");
        nextImagePath = uploadedImagePath;
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Bild konnte nicht hochgeladen werden.");
      return;
    }

    const { error } = await supabase.rpc("update_item_details", {
      item_id: editItem.id,
      item_name: editItemName.trim(),
      item_description: editItemDescription.trim() || null,
      item_value: nextValue,
      item_purchase_date: editItemPurchaseDate || null,
      item_status: editItemStatus || null,
      item_icon_name: editItemIcon || null,
      item_image_path: nextImagePath,
    });

    if (error) {
      if (uploadedImagePath) {
        await removeInventoryImage(uploadedImagePath);
      }
      window.alert(error.message);
      return;
    }

    if (editItem.location_id !== editItemLocation) {
      const { error: moveError } = await supabase.rpc("move_item", {
        item_id: editItem.id,
        target_location: editItemLocation,
      });

      if (moveError) {
        window.alert(moveError.message);
        return;
      }

      await logInventoryActivity({
        action: "move",
        entityId: editItem.id,
        entityType: "item",
        title: `Item verschoben: ${editItemName.trim()}`,
        description: `${editItemName.trim()} wurde in eine andere Location verschoben.`,
        metadata: {
          target_location_id: editItemLocation,
        },
      });
    }

    let nextLinkCount = 0;

    try {
      nextLinkCount = await replaceResourceLinks("item", editItem.id, editItemLinks);
    } catch (linkError) {
      window.alert(linkError instanceof Error ? linkError.message : "Links konnten nicht gespeichert werden.");
      return;
    }

    if ((editItemRemoveImage || uploadedImagePath) && editItem.image_path && editItem.image_path !== nextImagePath) {
      try {
        await removeInventoryImage(editItem.image_path);
      } catch (cleanupError) {
        window.alert(
          cleanupError instanceof Error ? cleanupError.message : "Altes Bild konnte nicht entfernt werden."
        );
      }
    }

    setEditItem(null);
    setEditItemName("");
    setEditItemDescription("");
    setEditItemValue("");
    setEditItemPurchaseDate("");
    setEditItemStatus("");
    setEditItemLocation(null);
    setEditItemIcon("");
    setEditItemImageFile(null);
    setEditItemRemoveImage(false);
    setEditItemLinks([]);
    await logInventoryActivity({
      action: "update",
      entityId: editItem.id,
      entityType: "item",
      title: `Item bearbeitet: ${editItemName.trim()}`,
      description: "Item-Details wurden aktualisiert.",
      metadata: {
        link_count: nextLinkCount,
      },
    });
    await fetchData();
  }

  async function moveItem() {
    if (!moveItemId || !moveItemTarget) {
      return;
    }

    const { error } = await supabase.rpc("move_item", {
      item_id: moveItemId,
      target_location: moveItemTarget,
    });

    if (error) {
      window.alert(error.message);
      return;
    }

    const movedItemName = items.find((item) => item.id === moveItemId)?.name ?? "Item";
    const targetLocationName = moveItemTarget ? getLocationName(moveItemTarget) : "Unbekannt";
    await logInventoryActivity({
      action: "move",
      entityId: moveItemId,
      entityType: "item",
      title: `Item verschoben: ${movedItemName}`,
      description: `${movedItemName} wurde nach ${targetLocationName} verschoben.`,
    });

    setMoveItemId(null);
    setMoveItemTarget(null);
    await fetchData();
  }

  async function deleteItem() {
    if (!deleteItemId) {
      return;
    }

    const { error } = await supabase.rpc("delete_item", {
      item_id: deleteItemId,
    });

    if (error) {
      window.alert(error.message);
      return;
    }

    const deletedItemName = items.find((item) => item.id === deleteItemId)?.name ?? "Item";
    await logInventoryActivity({
      action: "delete",
      entityId: deleteItemId,
      entityType: "item",
      title: `Item gelöscht: ${deletedItemName}`,
      description: "Item wurde entfernt.",
    });

    setDeleteItemId(null);
    await fetchData();
  }

  function resetCreate() {
    setCreateOpen(false);
    setCreateType("item");
    setCreateTarget("object");
    setCreateMode("manual");
    setSelectedTemplateId("");
    setItemName("");
    setItemDescription("");
    setItemLocation(selectedLocation);
    setItemStatus("");
    setItemValue("");
    setItemPurchaseDate("");
    setItemIcon("");
    setItemImageFile(null);
    setItemLinks([]);
    setLocName("");
    setLocParent(selectedLocation);
    setLocType("");
    setLocDescription("");
    setLocValue("");
    setLocIcon("");
    setLocImageFile(null);
    setLocLinks([]);
  }

  function openLocationEditModal(location: Location) {
    setEditLocation(location);
    setEditLocationName(location.name);
    setEditLocationType(location.type ?? "");
    setEditLocationDescription(location.description ?? "");
    setEditLocationParent(location.parent_id);
    setEditLocationValue(location.value?.toString() ?? "");
    setEditLocationIcon(location.icon_name ?? "");
    setEditLocationImageFile(null);
    setEditLocationRemoveImage(false);
    setEditLocationLinks([]);
    void loadResourceLinks("location", location.id)
      .then(setEditLocationLinks)
      .catch((error) => window.alert(error instanceof Error ? error.message : "Links konnten nicht geladen werden."));
  }

  function openItemEditModal(item: Item) {
    setEditItem(item);
    setEditItemName(item.name);
    setEditItemDescription(item.description ?? "");
    setEditItemValue(item.value?.toString() ?? "");
    setEditItemPurchaseDate(item.purchase_date ?? "");
    setEditItemStatus(item.status ?? "");
    setEditItemLocation(item.location_id);
    setEditItemIcon(item.icon_name ?? "");
    setEditItemImageFile(null);
    setEditItemRemoveImage(false);
    setEditItemLinks([]);
    void loadResourceLinks("item", item.id)
      .then(setEditItemLinks)
      .catch((error) => window.alert(error instanceof Error ? error.message : "Links konnten nicht geladen werden."));
  }

  function getItemsForLocation(locationId: string | null) {
    return items.filter((item) => item.location_id === locationId);
  }

  function getLocationName(locationId: string | null) {
    if (!locationId) {
      return "Keine Location";
    }

    return locations.find((location) => location.id === locationId)?.name ?? "Unbekannt";
  }

  function closeLocationEditModal() {
    setEditLocation(null);
    setEditLocationName("");
    setEditLocationType("");
    setEditLocationDescription("");
    setEditLocationParent(null);
    setEditLocationValue("");
    setEditLocationIcon("");
    setEditLocationImageFile(null);
    setEditLocationRemoveImage(false);
    setEditLocationLinks([]);
  }

  function closeItemEditModal() {
    setEditItem(null);
    setEditItemName("");
    setEditItemDescription("");
    setEditItemValue("");
    setEditItemPurchaseDate("");
    setEditItemStatus("");
    setEditItemLocation(null);
    setEditItemIcon("");
    setEditItemImageFile(null);
    setEditItemRemoveImage(false);
    setEditItemLinks([]);
  }

  function toggleLocationExpanded(locationId: string) {
    setExpandedLocations((current) => {
      const nextExpanded = new Set(current);

      if (nextExpanded.has(locationId)) {
        nextExpanded.delete(locationId);
      } else {
        nextExpanded.add(locationId);
      }

      return nextExpanded;
    });
  }

  const flatLocations = flattenTree(tree);
  const visibleItems = getItemsForLocation(selectedLocation);
  const selectedLocationName = getLocationName(selectedLocation);
  const matchingTemplates = templates.filter((template) => template.entity_type === createType);
  const selectedTemplate = matchingTemplates.find((template) => template.id === selectedTemplateId) ?? null;

  useEffect(() => {
    if (createTarget !== "object" || createMode !== "template" || !selectedTemplate) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (createType === "item") {
        setItemName(nextNameFromTemplate(selectedTemplate.name, items.map((item) => item.name)));
        setItemDescription(selectedTemplate.description ?? "");
        setItemStatus(selectedTemplate.item_status ?? "");
        setItemValue(selectedTemplate.item_value?.toString() ?? "");
        setItemPurchaseDate(selectedTemplate.item_purchase_date ?? "");
        setItemIcon(selectedTemplate.icon_name ?? "");
        setItemLinks(toResourceLinkDrafts(selectedTemplate.links));
        return;
      }

      setLocName(nextNameFromTemplate(selectedTemplate.name, locations.map((location) => location.name)));
      setLocDescription(selectedTemplate.description ?? "");
      setLocType(selectedTemplate.location_type ?? "");
      setLocValue(selectedTemplate.location_value?.toString() ?? "");
      setLocIcon(selectedTemplate.icon_name ?? "");
      setLocLinks(toResourceLinkDrafts(selectedTemplate.links));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [createMode, createTarget, createType, items, locations, selectedTemplate]);

  return (
    <div className="min-h-screen bg-[#eef3ea] text-gray-800 dark:bg-gray-950 dark:text-gray-100">
      <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4 lg:px-6 lg:py-5">
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:rounded-[1.75rem]">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="bg-gradient-to-br from-green-700 via-green-600 to-emerald-500 px-4 py-5 text-white md:px-6 lg:py-6">
              <div className="mt-4 max-w-2xl">
                <p className="text-xl font-semibold leading-tight text-green-50 lg:text-2xl">
                  Ordnung für alles, was zählt.
                </p>
                <p className="mt-1 max-w-xl text-sm text-green-50/90">
                  Zugriff auf Locations, Items und Suche.
                </p>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <DashboardLinkStat
                  href="/locations"
                  label="Locations"
                  value={String(locations.length)}
                  description="Verwalten"
                />
                <DashboardLinkStat
                  href="/items"
                  label="Items"
                  value={String(items.length)}
                  description="Durchsuchen"
                />
              </div>
            </div>

            <div className="px-4 py-5 md:px-6 lg:py-6">
              <div className="rounded-2xl border border-gray-200 p-3 dark:border-gray-700">
                <p className="text-sm font-semibold">Sucheinstieg</p>
                <form action="/search" className="mt-4 space-y-3">
                  <Input
                    name="q"
                    placeholder="Suchen"
                    value={dashboardQuery}
                    onChange={(event) => setDashboardQuery(event.target.value)}
                  />
                  <Button variant="ghost" className="w-full" type="submit">
                    Suchen
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-3 grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)] lg:gap-4">
          <aside className="overflow-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                  Struktur
                </p>
                <h2 className="text-xl font-semibold">Locations</h2>
              </div>
              <Link href="/locations" className="text-sm font-medium text-green-700 dark:text-green-400">
                Alle ansehen
              </Link>
            </div>

            <div className="space-y-1">
              {tree.length > 0 ? (
                tree.map((location) => (
                  <LocationNode
                    key={location.id}
                    location={location}
                    selected={selectedLocation}
                    setSelected={setSelectedLocation}
                    onMove={setMoveLocationId}
                    onDelete={setDeleteLocationId}
                    onEdit={openLocationEditModal}
                    expandedLocations={expandedLocations}
                    onToggleExpanded={toggleLocationExpanded}
                    showActions={false}
                  />
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  Noch keine Locations vorhanden.
                </p>
              )}
            </div>
          </aside>

          <main className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:p-5">
            <div className="mb-5 flex flex-col gap-4 border-b border-gray-200 pb-4 sm:flex-row sm:items-end sm:justify-between dark:border-gray-800">
              <div className="flex items-start gap-3">
                {selectedLocation ? (
                  <InventoryImage
                    alt={selectedLocationName}
                    imagePath={locations.find((location) => location.id === selectedLocation)?.image_path ?? null}
                    className="mt-1 h-12 w-12 rounded-2xl object-cover"
                    fallback={
                      <InventoryIconBadge className="mt-1 h-12 w-12 rounded-2xl bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300">
                        <LocationTypeIcon
                          type={locations.find((location) => location.id === selectedLocation)?.type ?? null}
                          iconName={locations.find((location) => location.id === selectedLocation)?.icon_name ?? null}
                        />
                      </InventoryIconBadge>
                    }
                  />
                ) : null}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                    Fokus
                  </p>
                  <h2 className="text-xl font-semibold lg:text-2xl">
                    {selectedLocation ? selectedLocationName : "Keine Location ausgewählt"}
                  </h2>
                  {selectedLocation ? (
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {getLocationTypeLabel(
                        locations.find((location) => location.id === selectedLocation)?.type ?? null
                      )}
                    </p>
                  ) : null}
                </div>
              </div>
              {selectedLocation ? (
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                    {visibleItems.length} Items
                  </div>
                  <Link
                    href={`/locations/${selectedLocation}`}
                    className="text-sm font-medium text-green-700 hover:text-green-800 dark:text-green-400"
                  >
                    Details
                  </Link>
                </div>
              ) : null}
            </div>

            {selectedLocation ? (
              visibleItems.length > 0 ? (
                <div className="space-y-2.5">
                  {visibleItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      locationLabel={selectedLocationName}
                      onEdit={openItemEditModal}
                      onMove={setMoveItemId}
                      onDelete={setDeleteItemId}
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                  In dieser Location liegen aktuell keine Items.
                </p>
              )
            ) : (
              <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  Wähle links eine Location aus, um ihren Inhalt zu sehen.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Link
                    href="/locations"
                    className="rounded-2xl bg-white px-4 py-4 text-sm shadow-sm transition hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-950"
                  >
                    Zur kompletten Location-Übersicht
                  </Link>
                  <Link
                    href="/items"
                    className="rounded-2xl bg-white px-4 py-4 text-sm shadow-sm transition hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-950"
                  >
                    Direkt zu allen Items
                  </Link>
                </div>
              </div>
            )}
          </main>
        </div>

        <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                Tags
              </p>
              <h2 className="text-xl font-semibold">Häufig verwendet</h2>
            </div>
            <Link href="/tags" className="text-sm font-medium text-green-700 dark:text-green-400">
              Alle Tags
            </Link>
          </div>

          <div className="flex flex-wrap gap-3">
            {topTags.length > 0 ? (
              topTags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/tags/${tag.id}`}
                  className="rounded-full bg-gray-100 px-4 py-3 text-sm transition hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                >
                  <span className="font-medium">{tag.name}</span>
                </Link>
              ))
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Noch keine verwendeten Tags vorhanden.
              </p>
            )}
          </div>
        </section>
      </div>

      <FloatingCreateButton ariaLabel="Neu anlegen" href="/?create=open&type=item" />

      {createOpen && (
        <Modal>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Neu anlegen</h3>

            <Select
              value={createType}
              onChange={(event) => {
                const nextType = event.target.value as "item" | "location";
                setCreateType(nextType);
                setSelectedTemplateId("");
                setItemValue("");
                setItemPurchaseDate("");
                setItemLinks([]);
                setLocValue("");
                setLocLinks([]);
              }}
            >
              <option value="item">Item</option>
              <option value="location">Location</option>
            </Select>

            <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => {
                  setCreateTarget("object");
                  setCreateMode("manual");
                }}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  createTarget === "object"
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                Objekt
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreateTarget("template");
                  setCreateMode("manual");
                }}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  createTarget === "template"
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                Vorlage
              </button>
            </div>

            {createTarget === "object" ? (
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => setCreateMode("manual")}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  createMode === "manual"
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                Manuell
              </button>
              <button
                type="button"
                onClick={() => setCreateMode("template")}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  createMode === "template"
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                Aus Vorlage
              </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-400">
                Der Name wird beim Speichern automatisch als Vorlage gespeichert und mit <code>-0000</code> abgeschlossen.
              </div>
            )}

            {createTarget === "object" && createMode === "template" ? (
              <>
                <Select
                  value={selectedTemplateId}
                  onChange={(event) => setSelectedTemplateId(event.target.value)}
                >
                  <option value="">Vorlage wählen</option>
                  {matchingTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </Select>

                {selectedTemplate ? (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/40">
                    <p className="text-sm font-semibold">{selectedTemplate.name}</p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {selectedTemplate.description?.trim() || "Keine Beschreibung"}
                    </p>
                    {createType === "location" && selectedTemplate.location_type ? (
                      <p className="mt-2 text-xs text-gray-400">
                        Typ: {getLocationTypeLabel(selectedTemplate.location_type)}
                      </p>
                    ) : null}
                    {createType === "item" && selectedTemplate.item_status ? (
                      <p className="mt-2 text-xs text-gray-400">
                        Status: {getItemStatusLabel(selectedTemplate.item_status)}
                      </p>
                    ) : null}
                    {createType === "item" && selectedTemplate.item_value != null ? (
                      <p className="mt-2 text-xs text-gray-400">
                        Preis: {selectedTemplate.item_value} EUR
                      </p>
                    ) : null}
                    {createType === "location" && selectedTemplate.location_value != null ? (
                      <p className="mt-2 text-xs text-gray-400">
                        Preis: {selectedTemplate.location_value} EUR
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {createType === "item" ? (
                  <Select
                    value={itemLocation ?? ""}
                    onChange={(event) => setItemLocation(event.target.value || null)}
                  >
                    <option value="">Location wählen</option>
                    {flatLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Select
                    value={locParent ?? ""}
                    onChange={(event) => setLocParent(event.target.value || null)}
                  >
                    <option value="">Root</option>
                    {flatLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </Select>
                )}
                {createType === "item" ? (
                  <>
                    <Input
                      placeholder="Item-Name"
                      value={itemName}
                      onChange={(event) => setItemName(event.target.value)}
                    />
                    <textarea
                      placeholder="Beschreibung"
                      value={itemDescription}
                      onChange={(event) => setItemDescription(event.target.value)}
                      className="min-h-24 w-full rounded-md border bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                    />
                    <Select
                      value={itemStatus}
                      onChange={(event) => setItemStatus((event.target.value as ItemStatus) || "")}
                    >
                      <option value="">Status leer lassen</option>
                      {ITEM_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Preis in EUR"
                      value={itemValue}
                      onChange={(event) => setItemValue(event.target.value)}
                    />
                    <Input
                      type="date"
                      value={itemPurchaseDate}
                      onChange={(event) => setItemPurchaseDate(event.target.value)}
                    />
                    <IconPicker label="Item-Icon" value={itemIcon} onChange={setItemIcon} emptyLabel="Icon automatisch wählen" />
                    <ImagePicker
                      label="Item-Bild"
                      currentImagePath={selectedTemplate?.image_path ?? null}
                      pendingFile={itemImageFile}
                      onFileChange={setItemImageFile}
                      removeImage={false}
                      onRemoveChange={() => undefined}
                      fallback={
                        <InventoryIconBadge className="h-16 w-16 rounded-3xl bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300">
                          <ItemStatusIcon status={itemStatus || null} iconName={itemIcon || null} className="h-8 w-8" />
                        </InventoryIconBadge>
                      }
                    />
                    <ResourceLinksEditor value={itemLinks} onChange={setItemLinks} />
                  </>
                ) : (
                  <>
                    <Input
                      placeholder="Location-Name"
                      value={locName}
                      onChange={(event) => setLocName(event.target.value)}
                    />
                    <textarea
                      placeholder="Beschreibung"
                      value={locDescription}
                      onChange={(event) => setLocDescription(event.target.value)}
                      className="min-h-24 w-full rounded-md border bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                    />
                    <Select
                      value={locType}
                      onChange={(event) => setLocType((event.target.value as LocationType) || "")}
                    >
                      <option value="">Typ leer lassen</option>
                      {LOCATION_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Preis in EUR"
                      value={locValue}
                      onChange={(event) => setLocValue(event.target.value)}
                    />
                    <IconPicker label="Location-Icon" value={locIcon} onChange={setLocIcon} emptyLabel="Icon automatisch wählen" />
                    <ImagePicker
                      label="Location-Bild"
                      currentImagePath={selectedTemplate?.image_path ?? null}
                      pendingFile={locImageFile}
                      onFileChange={setLocImageFile}
                      removeImage={false}
                      onRemoveChange={() => undefined}
                      fallback={
                        <InventoryIconBadge className="h-16 w-16 rounded-3xl bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300">
                          <LocationTypeIcon type={locType || null} iconName={locIcon || null} className="h-8 w-8" />
                        </InventoryIconBadge>
                      }
                    />
                    <ResourceLinksEditor value={locLinks} onChange={setLocLinks} />
                  </>
                )}
              </>
            ) : createType === "item" ? (
              <>
                <Input
                  placeholder={createTarget === "template" ? "Vorlagenname" : "Item-Name"}
                  value={itemName}
                  onChange={(event) => setItemName(event.target.value)}
                />

                <textarea
                  placeholder="Beschreibung"
                  value={itemDescription}
                  onChange={(event) => setItemDescription(event.target.value)}
                  className="min-h-24 w-full rounded-md border bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                />
                <Select
                  value={itemStatus}
                  onChange={(event) => setItemStatus((event.target.value as ItemStatus) || "")}
                >
                  <option value="">Status leer lassen</option>
                  {ITEM_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Preis in EUR"
                  value={itemValue}
                  onChange={(event) => setItemValue(event.target.value)}
                />
                <Input
                  type="date"
                  value={itemPurchaseDate}
                  onChange={(event) => setItemPurchaseDate(event.target.value)}
                />
                <ResourceLinksEditor value={itemLinks} onChange={setItemLinks} />

                {createTarget === "object" ? (
                  <Select
                    value={itemLocation ?? ""}
                    onChange={(event) => setItemLocation(event.target.value || null)}
                  >
                    <option value="">Location wählen</option>
                    {flatLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </Select>
                ) : null}
                <IconPicker
                  label="Item-Icon"
                  value={itemIcon}
                  onChange={setItemIcon}
                  emptyLabel={createTarget === "template" ? "Icon für Vorlage offen lassen" : "Icon automatisch wählen"}
                />
                <ImagePicker
                  label={createTarget === "template" ? "Vorlagenbild" : "Item-Bild"}
                  currentImagePath={null}
                  pendingFile={itemImageFile}
                  onFileChange={setItemImageFile}
                  removeImage={false}
                  onRemoveChange={() => undefined}
                  fallback={
                    <InventoryIconBadge className="h-16 w-16 rounded-3xl bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300">
                      <ItemStatusIcon status={itemStatus || null} iconName={itemIcon || null} className="h-8 w-8" />
                    </InventoryIconBadge>
                  }
                />
              </>
            ) : (
              <>
                <Input
                  placeholder={createTarget === "template" ? "Vorlagenname" : "Location-Name"}
                  value={locName}
                  onChange={(event) => setLocName(event.target.value)}
                />
                <textarea
                  placeholder="Beschreibung"
                  value={locDescription}
                  onChange={(event) => setLocDescription(event.target.value)}
                  className="min-h-24 w-full rounded-md border bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                />
                <Select
                  value={locType}
                  onChange={(event) => setLocType((event.target.value as LocationType) || "")}
                >
                  <option value="">Typ leer lassen</option>
                  {LOCATION_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Preis in EUR"
                  value={locValue}
                  onChange={(event) => setLocValue(event.target.value)}
                />
                <ResourceLinksEditor value={locLinks} onChange={setLocLinks} />
                <IconPicker
                  label="Location-Icon"
                  value={locIcon}
                  onChange={setLocIcon}
                  emptyLabel={createTarget === "template" ? "Icon für Vorlage offen lassen" : "Icon automatisch wählen"}
                />
                <ImagePicker
                  label={createTarget === "template" ? "Vorlagenbild" : "Location-Bild"}
                  currentImagePath={null}
                  pendingFile={locImageFile}
                  onFileChange={setLocImageFile}
                  removeImage={false}
                  onRemoveChange={() => undefined}
                  fallback={
                    <InventoryIconBadge className="h-16 w-16 rounded-3xl bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300">
                      <LocationTypeIcon type={locType || null} iconName={locIcon || null} className="h-8 w-8" />
                    </InventoryIconBadge>
                  }
                />

                {createTarget === "object" ? (
                  <Select
                    value={locParent ?? ""}
                    onChange={(event) => setLocParent(event.target.value || null)}
                  >
                    <option value="">Root</option>
                    {flatLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </Select>
                ) : null}
              </>
            )}

            <div className="flex justify-between">
              <Button onClick={resetCreate}>Abbrechen</Button>
              <Button variant="primary" onClick={() => void create()}>
                Erstellen
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {editLocation && (
        <Modal>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Location bearbeiten</h3>
            <FieldInfo label="ID" value={editLocation.id} />
            <FieldInfo
              label="Parent"
              value={editLocation.parent_id ? getLocationName(editLocation.parent_id) : "Root"}
            />
            <FieldInfo label="Typ" value={getLocationTypeLabel(editLocation.type)} />
            <FieldInfo
              label="Preis"
              value={editLocation.value != null ? `${editLocation.value} EUR` : "Nicht hinterlegt"}
            />
            <FieldInfo
              label="Erstellt"
              value={editLocation.created_at ? editLocation.created_at : "Unbekannt"}
            />
            <Input
              placeholder="Name"
              value={editLocationName}
              onChange={(event) => setEditLocationName(event.target.value)}
            />
            <Select
              value={editLocationType}
              onChange={(event) => setEditLocationType((event.target.value as LocationType) || "")}
            >
              <option value="">Typ entfernen</option>
              {LOCATION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <IconPicker label="Icon" value={editLocationIcon} onChange={setEditLocationIcon} emptyLabel="Icon entfernen" />
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Preis in EUR
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="z. B. 5.00"
                value={editLocationValue}
                onChange={(event) => setEditLocationValue(event.target.value)}
              />
            </div>
            <ImagePicker
              label="Bild"
              currentImagePath={editLocation.image_path}
              pendingFile={editLocationImageFile}
              onFileChange={setEditLocationImageFile}
              removeImage={editLocationRemoveImage}
              onRemoveChange={setEditLocationRemoveImage}
              fallback={
                <InventoryIconBadge className="h-16 w-16 rounded-3xl bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300">
                  <LocationTypeIcon
                    type={editLocationType || editLocation.type}
                    iconName={editLocationIcon || editLocation.icon_name}
                    className="h-8 w-8"
                  />
                </InventoryIconBadge>
              }
            />
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Parent / Ziel-Location
              </label>
              <Select
                value={editLocationParent ?? ""}
                onChange={(event) => setEditLocationParent(event.target.value || null)}
              >
                <option value="">Root</option>
                {flatLocations
                  .filter((location) => location.id !== editLocation.id)
                  .map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
              </Select>
            </div>
            <textarea
              placeholder="Beschreibung"
              value={editLocationDescription}
              onChange={(event) => setEditLocationDescription(event.target.value)}
              className="min-h-24 w-full rounded-md border bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
            />
            <ResourceLinksEditor value={editLocationLinks} onChange={setEditLocationLinks} />

            <div className="flex justify-between">
              <Button onClick={closeLocationEditModal}>Abbrechen</Button>
              <Button variant="primary" onClick={() => void updateLocation()}>
                Speichern
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {moveLocationId && (
        <Modal>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Location verschieben</h3>
            <Select
              value={moveTarget ?? ""}
              onChange={(event) => setMoveTarget(event.target.value || null)}
            >
              <option value="">Root</option>
              {flatLocations
                .filter((location) => location.id !== moveLocationId)
                .map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
            </Select>

            <div className="flex justify-between">
              <Button
                onClick={() => {
                  setMoveLocationId(null);
                  setMoveTarget(null);
                }}
              >
                Abbrechen
              </Button>
              <Button variant="primary" onClick={() => void moveLocation()}>
                Verschieben
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {deleteLocationId && (
        <Modal>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Location löschen</h3>
            <Select
              value={deleteStrategy}
              onChange={(event) => setDeleteStrategy(event.target.value as DeleteStrategy)}
            >
              <option value="unpack">unpack</option>
              <option value="box">box</option>
              <option value="delete">delete</option>
            </Select>

            <div className="flex justify-between">
              <Button
                onClick={() => {
                  setDeleteLocationId(null);
                  setDeleteStrategy("unpack");
                }}
              >
                Abbrechen
              </Button>
              <Button variant="danger" onClick={() => void deleteLocation()}>
                Löschen
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {editItem && (
        <Modal>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Item bearbeiten</h3>
            <FieldInfo label="ID" value={editItem.id} />
            <FieldInfo
              label="Erstellt"
              value={editItem.created_at ? editItem.created_at : "Unbekannt"}
            />
            <Input
              placeholder="Name"
              value={editItemName}
              onChange={(event) => setEditItemName(event.target.value)}
            />
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Location
              </label>
              <Select
                value={editItemLocation ?? ""}
                onChange={(event) => setEditItemLocation(event.target.value || null)}
              >
                    <option value="">Location wählen</option>
                {flatLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Icon
              </label>
              <IconPicker label="Icon" value={editItemIcon} onChange={setEditItemIcon} emptyLabel="Icon entfernen" />
            </div>
            <ImagePicker
              label="Bild"
              currentImagePath={editItem.image_path}
              pendingFile={editItemImageFile}
              onFileChange={setEditItemImageFile}
              removeImage={editItemRemoveImage}
              onRemoveChange={setEditItemRemoveImage}
              fallback={
                <InventoryIconBadge className="h-16 w-16 rounded-3xl bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300">
                  <ItemStatusIcon
                    status={editItemStatus || editItem.status}
                    iconName={editItemIcon || editItem.icon_name}
                    className="h-8 w-8"
                  />
                </InventoryIconBadge>
              }
            />
            <textarea
              placeholder="Beschreibung"
              value={editItemDescription}
              onChange={(event) => setEditItemDescription(event.target.value)}
              className="min-h-24 w-full rounded-md border bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
            />
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Preis in EUR
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="z. B. 19.99"
                value={editItemValue}
                onChange={(event) => setEditItemValue(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Kaufdatum
              </label>
              <Input
                type="date"
                value={editItemPurchaseDate}
                onChange={(event) => setEditItemPurchaseDate(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Status
              </label>
              <Select
                value={editItemStatus}
                onChange={(event) => setEditItemStatus((event.target.value as ItemStatus) || "")}
              >
                <option value="">Status entfernen</option>
                {ITEM_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <ResourceLinksEditor value={editItemLinks} onChange={setEditItemLinks} />

            <div className="flex justify-between">
              <Button onClick={closeItemEditModal}>Abbrechen</Button>
              <Button variant="primary" onClick={() => void updateItem()}>
                Speichern
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {moveItemId && (
        <Modal>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Item verschieben</h3>
            <Select
              value={moveItemTarget ?? ""}
              onChange={(event) => setMoveItemTarget(event.target.value || null)}
            >
              <option value="">Location wählen</option>
              {flatLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </Select>

            <div className="flex justify-between">
              <Button
                onClick={() => {
                  setMoveItemId(null);
                  setMoveItemTarget(null);
                }}
              >
                Abbrechen
              </Button>
              <Button variant="primary" onClick={() => void moveItem()}>
                Verschieben
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {deleteItemId && (
        <Modal>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Item löschen</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Das Item wird direkt entfernt.
            </p>

            <div className="flex justify-between">
              <Button onClick={() => setDeleteItemId(null)}>Abbrechen</Button>
              <Button variant="danger" onClick={() => void deleteItem()}>
                Löschen
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Menu({ children, label }: MenuProps) {
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

      {open && (
        <div
          onClick={(event) => event.stopPropagation()}
          className="absolute right-0 z-50 mt-2 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          {children}
        </div>
      )}
    </div>
  );
}

function MenuAction({
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
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${className}`}
    >
      {children}
    </button>
  );
}

function LocationNode({
  location,
  selected,
  setSelected,
  onMove,
  onDelete,
  onEdit,
  expandedLocations,
  onToggleExpanded,
  showActions = true,
}: LocationNodeProps) {
  const children = location.children ?? [];
  const hasChildren = children.length > 0;
  const isExpanded = expandedLocations.has(location.id);

  return (
    <div className="ml-1.5">
      <div className="group flex items-center justify-between gap-2 rounded-lg pr-1">
        {hasChildren ? (
          <button
            type="button"
            aria-label={isExpanded ? `${location.name} einklappen` : `${location.name} ausklappen`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpanded(location.id);
            }}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            {isExpanded ? <MdExpandMore className="h-5 w-5" /> : <MdKeyboardArrowRight className="h-5 w-5" />}
          </button>
        ) : (
          <span className="h-8 w-8 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => setSelected(location.id)}
          className={`flex flex-1 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
            selected === location.id
              ? "bg-blue-500 text-white shadow-sm"
              : "hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          <LocationTypeIcon
            type={location.type}
            className={selected === location.id ? "text-white" : "text-gray-500 dark:text-gray-300"}
            iconName={location.icon_name}
          />
          <span>{location.name}</span>
        </button>

        {showActions ? (
          <div className="opacity-0 transition group-hover:opacity-100">
            <Menu label={`Aktionen für ${location.name}`}>
              <Link
                href={`/locations/${location.id}`}
                className="block px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Details
              </Link>
              <MenuAction onClick={() => onEdit(location)}>Bearbeiten</MenuAction>
              <MenuAction onClick={() => onMove(location.id)}>Verschieben</MenuAction>
              <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
              <MenuAction className="text-red-500" onClick={() => onDelete(location.id)}>
                Löschen
              </MenuAction>
            </Menu>
          </div>
        ) : null}
      </div>

      {hasChildren && isExpanded ? (
        <div className="ml-4 border-l border-gray-200 pl-3 dark:border-gray-700">
          {children.map((child) => (
            <LocationNode
              key={child.id}
              location={child}
              selected={selected}
              setSelected={setSelected}
              onMove={onMove}
              onDelete={onDelete}
              onEdit={onEdit}
              expandedLocations={expandedLocations}
              onToggleExpanded={onToggleExpanded}
              showActions={showActions}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ItemCard({ item, locationLabel, onEdit, onMove, onDelete }: ItemCardProps) {
  return (
    <div className="flex items-start justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start gap-3">
        <InventoryImage
          alt={item.name}
          imagePath={item.image_path}
          className="h-12 w-12 rounded-2xl object-cover"
          fallback={
            <InventoryIconBadge className="h-12 w-12 rounded-2xl bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300">
              <ItemStatusIcon status={item.status} iconName={item.icon_name} className="h-5 w-5" />
            </InventoryIconBadge>
          }
        />
        <div>
          <Link
            href={`/items/${item.id}`}
            className="font-medium hover:text-blue-600 dark:hover:text-blue-400"
          >
          {item.name}
          </Link>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{locationLabel}</p>
          <p className="mt-1 text-xs font-medium text-gray-400 dark:text-gray-500">
            {getItemStatusLabel(item.status)}
          </p>
          {item.icon_name ? (
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Icon: {getMaterialIconLabel(item.icon_name)}
            </p>
          ) : null}
        </div>
      </div>

      <Menu label={`Aktionen für ${item.name}`}>
        <MenuAction onClick={() => onEdit(item)}>Bearbeiten</MenuAction>
        <MenuAction onClick={() => onMove(item.id)}>Verschieben</MenuAction>
        <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
        <MenuAction className="text-red-500" onClick={() => onDelete(item.id)}>
          Löschen
        </MenuAction>
      </Menu>
    </div>
  );
}

function FieldInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-900/40">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">{label}</p>
      <p className="mt-1 break-all text-gray-600 dark:text-gray-300">{value}</p>
    </div>
  );
}

function DashboardLinkStat({
  description,
  href,
  label,
  value,
}: {
  description: string;
  href: string;
  label: string;
  value: string;
}) {
  const icon =
    label === "Locations" ? (
      <LocationTypeIcon type="site" className="h-5 w-5 text-white" />
    ) : (
      <ItemStatusIcon status="stored" className="h-5 w-5 text-white" />
    );

  return (
    <Link
      href={href}
      className="rounded-xl border border-white/15 bg-white/10 px-3 py-3 backdrop-blur-sm transition hover:bg-white/15"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-green-100/80">{label}</p>
          <div className="mt-1 flex items-end gap-2">
            <p className="text-2xl font-semibold leading-none text-white lg:text-[1.9rem]">{value}</p>
            <p className="pb-0.5 text-sm text-green-50/90">{description}</p>
          </div>
        </div>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
          {icon}
        </span>
      </div>
    </Link>
  );
}
