"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionMenu, ActionMenuButton } from "@/components/inventory/ActionMenu";
import { DetailField } from "@/components/inventory/DetailField";
import { ImagePicker } from "@/components/inventory/ImagePicker";
import { InventoryImage } from "@/components/inventory/InventoryImage";
import { ItemDocumentsManager } from "@/components/inventory/ItemDocumentsManager";
import {
  InventoryIconBadge,
  ItemStatusIcon,
  getMaterialIconLabel,
} from "@/components/inventory/InventoryIcon";
import { IconPicker } from "@/components/inventory/IconPicker";
import { RelatedItemsManager } from "@/components/inventory/RelatedItemsManager";
import {
  ResourceLinksEditor,
  ResourceLinksList,
  normalizeResourceLinkDrafts,
  toResourceLinkDrafts,
  type ResourceLinkDraft,
} from "@/components/inventory/ResourceLinksEditor";
import { TagManager } from "@/components/inventory/TagManager";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { logInventoryActivity } from "@/lib/inventory-activity";
import { ITEM_STATUS_OPTIONS, getItemStatusLabel, type ItemStatus } from "@/lib/inventory";
import { removeInventoryImage, uploadInventoryImage } from "@/lib/inventory-media";
import {
  fetchItemDetailData,
  type ItemDetailData,
  type ItemRecord,
} from "@/lib/inventory-data";
import { supabase } from "@/lib/supabase";

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("de-DE");
}

function formatPrice(value?: number | null) {
  if (value == null) {
    return "-";
  }

  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export function ItemDetailPage({
  initialData,
  itemId,
}: {
  initialData: ItemDetailData;
  itemId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [item, setItem] = useState<ItemRecord | null>(initialData.item);
  const [locations, setLocations] = useState(initialData.locations);
  const [assignedTags, setAssignedTags] = useState(initialData.assignedTags);
  const [availableTags, setAvailableTags] = useState(initialData.availableTags);
  const [documents, setDocuments] = useState(initialData.documents);
  const [linkedItems, setLinkedItems] = useState(initialData.linkedItems);
  const [allItems, setAllItems] = useState(initialData.allItems);
  const [links, setLinks] = useState(initialData.links);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(initialData.item?.name ?? "");
  const [editLocation, setEditLocation] = useState<string | null>(initialData.item?.location_id ?? null);
  const [editDescription, setEditDescription] = useState(initialData.item?.description ?? "");
  const [editPrice, setEditPrice] = useState(initialData.item?.value?.toString() ?? "");
  const [editPurchaseDate, setEditPurchaseDate] = useState(initialData.item?.purchase_date ?? "");
  const [editStatus, setEditStatus] = useState<ItemStatus | "">(initialData.item?.status ?? "");
  const [editIconName, setEditIconName] = useState(initialData.item?.icon_name ?? "");
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [editLinks, setEditLinks] = useState<ResourceLinkDraft[]>(toResourceLinkDrafts(initialData.links));

  const [deleteOpen, setDeleteOpen] = useState(false);

  async function reloadItemData() {
    setLoading(true);
    try {
      const data = await fetchItemDetailData(itemId);

      setItem(data.item);
      setLocations(data.locations);
      setAssignedTags(data.assignedTags);
      setAvailableTags(data.availableTags);
      setDocuments(data.documents);
      setLinkedItems(data.linkedItems);
      setAllItems(data.allItems);
      setLinks(data.links);
      setEditLinks(toResourceLinkDrafts(data.links));

      if (data.item) {
        setEditName(data.item.name);
        setEditLocation(data.item.location_id);
        setEditDescription(data.item.description ?? "");
        setEditPrice(data.item.value?.toString() ?? "");
        setEditPurchaseDate(data.item.purchase_date ?? "");
        setEditStatus(data.item.status ?? "");
        setEditIconName(data.item.icon_name ?? "");
        setEditImageFile(null);
        setRemoveImage(false);
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Item konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  const locationName = useMemo(() => {
    if (!item?.location_id) {
      return "Keine Location";
    }

    return locations.find((location) => location.id === item.location_id)?.name ?? "Unbekannt";
  }, [item, locations]);

  async function saveItem() {
    if (!item) {
      return;
    }

    const normalizedPrice = editPrice.trim() === "" ? null : Number(editPrice);

    if (normalizedPrice !== null && Number.isNaN(normalizedPrice)) {
      window.alert("Preis muss eine gültige Zahl sein.");
      return;
    }

    let normalizedLinks: Array<{ label: string; url: string }> = [];

    try {
      normalizedLinks = normalizeResourceLinkDrafts(editLinks);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Links konnten nicht gespeichert werden.");
      return;
    }

    let uploadedImagePath: string | null = null;
    let nextImagePath = removeImage ? null : item.image_path ?? null;

    try {
      if (editImageFile) {
        uploadedImagePath = await uploadInventoryImage(editImageFile, "items");
        nextImagePath = uploadedImagePath;
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Bild konnte nicht hochgeladen werden.");
      return;
    }

    const { error } = await supabase.rpc("update_item_details", {
      item_id: item.id,
      item_name: editName.trim(),
      item_description: editDescription.trim() || null,
      item_value: normalizedPrice,
      item_purchase_date: editPurchaseDate || null,
      item_status: editStatus || null,
      item_icon_name: editIconName || null,
      item_image_path: nextImagePath,
    });

    if (error) {
      if (uploadedImagePath) {
        await removeInventoryImage(uploadedImagePath);
      }
      window.alert(error.message);
      return;
    }

    if (item.location_id !== editLocation) {
      const { error: moveError } = await supabase.rpc("move_item", {
        item_id: item.id,
        target_location: editLocation,
      });

      if (moveError) {
        window.alert(moveError.message);
        return;
      }

      const targetLocationName =
        locations.find((location) => location.id === editLocation)?.name ?? "Unbekannte Location";

      await logInventoryActivity({
        action: "move",
        entityId: item.id,
        entityType: "item",
        title: `Item verschoben: ${item.name}`,
        description: `${item.name} wurde nach ${targetLocationName} verschoben.`,
        metadata: {
          item_id: item.id,
          target_location_id: editLocation,
        },
      });
    }

    const deleteLinksResponse = await supabase
      .from("inventory_resource_links")
      .delete()
      .eq("entity_type", "item")
      .eq("entity_id", item.id);

    if (deleteLinksResponse.error) {
      window.alert(deleteLinksResponse.error.message);
      return;
    }

    if (normalizedLinks.length > 0) {
      const { error: linksError } = await supabase.from("inventory_resource_links").insert(
        normalizedLinks.map((link) => ({
          entity_type: "item",
          entity_id: item.id,
          label: link.label,
          url: link.url,
        }))
      );

      if (linksError) {
        window.alert(linksError.message);
        return;
      }
    }

    if ((removeImage || uploadedImagePath) && item.image_path && item.image_path !== nextImagePath) {
      try {
        await removeInventoryImage(item.image_path);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Altes Bild konnte nicht entfernt werden.");
      }
    }

    setEditOpen(false);
    setEditImageFile(null);
    setRemoveImage(false);
    await logInventoryActivity({
      action: "update",
      entityId: item.id,
      entityType: "item",
      title: `Item bearbeitet: ${editName.trim()}`,
      description: "Item-Details wurden aktualisiert.",
      metadata: {
        item_id: item.id,
      },
    });
    await reloadItemData();
  }

  async function deleteItem() {
    if (!item) {
      return;
    }

    const { error } = await supabase.rpc("delete_item", {
      item_id: item.id,
    });

    if (error) {
      window.alert(error.message);
      return;
    }

    await logInventoryActivity({
      action: "delete",
      entityId: item.id,
      entityType: "item",
      title: `Item gelöscht: ${item.name}`,
      description: "Item wurde entfernt.",
      metadata: {
        item_id: item.id,
      },
    });

    router.push("/");
  }

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Lade Item...</div>;
  }

  if (!item) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Item nicht gefunden.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-blue-600">
          Zurück zur Übersicht
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 text-gray-800 dark:bg-gray-950 dark:text-gray-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <InventoryImage
              alt={item.name}
              imagePath={item.image_path}
              className="h-16 w-16 rounded-3xl object-cover"
              fallback={
                <InventoryIconBadge className="h-16 w-16 rounded-3xl bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300">
                  <ItemStatusIcon status={item.status} iconName={item.icon_name} className="h-7 w-7" />
                </InventoryIconBadge>
              }
            />
            <div>
              <Link href="/" className="text-sm text-blue-600 dark:text-blue-400">
                Zurück zur Übersicht
              </Link>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                Item
              </p>
              <h1 className="text-3xl font-semibold">{item.name}</h1>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300">
                  {getItemStatusLabel(item.status)}
                </span>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {locationName}
                </span>
              </div>
              {item.icon_name ? (
                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                  Icon: {getMaterialIconLabel(item.icon_name)}
                </p>
              ) : null}
            </div>
          </div>

          <ActionMenu label={`Aktionen für ${item.name}`}>
            <ActionMenuButton
              onClick={() => {
                setEditLinks(toResourceLinkDrafts(links));
                setEditOpen(true);
              }}
            >
              Bearbeiten
            </ActionMenuButton>
            <ActionMenuButton className="text-red-500" onClick={() => setDeleteOpen(true)}>
              Löschen
            </ActionMenuButton>
          </ActionMenu>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm dark:bg-gray-900">
            <div className="overflow-hidden rounded-3xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40">
              <InventoryImage
                alt={item.name}
                imagePath={item.image_path}
                className="h-auto w-full object-contain"
                fallback={
                  <div className="flex h-72 w-full items-center justify-center">
                    <InventoryIconBadge className="h-24 w-24 rounded-[2rem] bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300">
                      <ItemStatusIcon status={item.status} iconName={item.icon_name} className="h-12 w-12" />
                    </InventoryIconBadge>
                  </div>
                }
              />
            </div>

            <div className="mt-5 rounded-3xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-800/70">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                Beschreibung
              </p>
              <p className="mt-3 whitespace-pre-line text-base leading-7 text-gray-700 dark:text-gray-200">
                {item.description?.trim() ? item.description : "Keine Beschreibung hinterlegt."}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <section className="rounded-3xl bg-white p-5 shadow-sm dark:bg-gray-900">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                Schnellinfo
              </p>
              <div className="mt-4 grid gap-3">
                <DetailField label="Location" value={locationName} />
                <DetailField label="Status" value={getItemStatusLabel(item.status)} />
                <DetailField label="Preis" value={formatPrice(item.value)} />
                <DetailField label="Kaufdatum" value={item.purchase_date ?? "-"} />
                <DetailField label="Erstellt" value={formatDate(item.created_at)} />
                <DetailField label="ID" value={item.id} />
              </div>
            </section>

            <section className="rounded-3xl bg-white p-5 shadow-sm dark:bg-gray-900">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                Einordnung
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {assignedTags.length > 0 ? (
                  assignedTags.map((tag) => (
                    <Link
                      key={tag.id}
                      href={`/tags/${tag.id}`}
                      className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      {tag.name}
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Keine Tags zugeordnet.</p>
                )}
              </div>
            </section>
          </div>
        </section>

        <ItemDocumentsManager documents={documents} itemId={item.id} onChange={reloadItemData} />

        <ResourceLinksList links={links} />

        <RelatedItemsManager
          currentItem={item}
          linkedItems={linkedItems}
          locations={locations}
          selectableItems={allItems}
          onChange={reloadItemData}
        />
      </div>

      {editOpen ? (
        <Modal>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Item bearbeiten</h3>
            <Input value={editName} onChange={(event) => setEditName(event.target.value)} />
            <Select
              value={editLocation ?? ""}
              onChange={(event) => setEditLocation(event.target.value || null)}
            >
              <option value="">Location wählen</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
                ))}
            </Select>
            <IconPicker label="Icon" value={editIconName} onChange={setEditIconName} emptyLabel="Icon entfernen" />
            <ImagePicker
              label="Bild"
              currentImagePath={item.image_path}
              pendingFile={editImageFile}
              onFileChange={setEditImageFile}
              removeImage={removeImage}
              onRemoveChange={setRemoveImage}
              fallback={
                <InventoryIconBadge className="h-16 w-16 rounded-3xl bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300">
                  <ItemStatusIcon status={item.status} iconName={editIconName || item.icon_name} className="h-8 w-8" />
                </InventoryIconBadge>
              }
            />
            <textarea
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
              placeholder="Beschreibung"
              className="min-h-28 w-full rounded-md border bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
            />
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="Preis in EUR"
              value={editPrice}
              onChange={(event) => setEditPrice(event.target.value)}
            />
            <Input
              type="date"
              value={editPurchaseDate}
              onChange={(event) => setEditPurchaseDate(event.target.value)}
            />
            <Select
              value={editStatus}
              onChange={(event) => setEditStatus((event.target.value as ItemStatus) || "")}
            >
              <option value="">Status entfernen</option>
              {ITEM_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <TagManager
              entityId={item.id}
              entityType="item"
              assignedTags={assignedTags}
              availableTags={availableTags}
              onChange={reloadItemData}
            />
            <ResourceLinksEditor value={editLinks} onChange={setEditLinks} />
            <div className="flex justify-between">
              <Button
                onClick={() => {
                  setEditLinks(toResourceLinkDrafts(links));
                  setEditOpen(false);
                }}
              >
                Abbrechen
              </Button>
              <Button variant="primary" onClick={() => void saveItem()}>
                Speichern
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {deleteOpen ? (
        <Modal>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Item löschen</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Das Item wird direkt entfernt.
            </p>
            <div className="flex justify-between">
              <Button onClick={() => setDeleteOpen(false)}>Abbrechen</Button>
              <Button variant="danger" onClick={() => void deleteItem()}>
                Löschen
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
