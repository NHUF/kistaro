"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionMenu, ActionMenuButton } from "@/components/inventory/ActionMenu";
import { DetailField } from "@/components/inventory/DetailField";
import { ImagePicker } from "@/components/inventory/ImagePicker";
import { InventoryImage } from "@/components/inventory/InventoryImage";
import {
  InventoryIconBadge,
  ItemStatusIcon,
  LocationTypeIcon,
  getMaterialIconLabel,
} from "@/components/inventory/InventoryIcon";
import { IconPicker } from "@/components/inventory/IconPicker";
import { ResourceLinksManager } from "@/components/inventory/ResourceLinksManager";
import { TagManager } from "@/components/inventory/TagManager";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { logInventoryActivity } from "@/lib/inventory-activity";
import { LOCATION_TYPE_OPTIONS, getLocationTypeLabel, type LocationType } from "@/lib/inventory";
import { removeInventoryImage, uploadInventoryImage } from "@/lib/inventory-media";
import {
  fetchLocationDetailData,
  type ItemListRecord,
  type LocationDetailData,
  type LocationRecord,
} from "@/lib/inventory-data";
import { supabase } from "@/lib/supabase";

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("de-DE");
}

function parseOptionalPrice(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const parsedValue = Number(trimmedValue);

  if (Number.isNaN(parsedValue)) {
    throw new Error("Preis muss eine gültige Zahl sein.");
  }

  return parsedValue;
}

export function LocationDetailPage({
  initialData,
  locationId,
}: {
  initialData: LocationDetailData;
  locationId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<LocationRecord | null>(initialData.location);
  const [allLocations, setAllLocations] = useState<LocationRecord[]>(initialData.allLocations);
  const [childLocations, setChildLocations] = useState<LocationRecord[]>(initialData.childLocations);
  const [items, setItems] = useState<ItemListRecord[]>(initialData.items);
  const [assignedTags, setAssignedTags] = useState(initialData.assignedTags);
  const [availableTags, setAvailableTags] = useState(initialData.availableTags);
  const [links, setLinks] = useState(initialData.links);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(initialData.location?.name ?? "");
  const [editType, setEditType] = useState<LocationType | "">(initialData.location?.type ?? "");
  const [editDescription, setEditDescription] = useState(initialData.location?.description ?? "");
  const [editParent, setEditParent] = useState<string | null>(initialData.location?.parent_id ?? null);
  const [editValue, setEditValue] = useState(initialData.location?.value?.toString() ?? "");
  const [editIconName, setEditIconName] = useState(initialData.location?.icon_name ?? "");
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteStrategy, setDeleteStrategy] = useState<"unpack" | "box" | "delete">("unpack");

  async function reloadLocationData() {
    setLoading(true);
    try {
      const data = await fetchLocationDetailData(locationId);

      setLocation(data.location);
      setAllLocations(data.allLocations);
      setChildLocations(data.childLocations);
      setItems(data.items);
      setAssignedTags(data.assignedTags);
      setAvailableTags(data.availableTags);
      setLinks(data.links);

      if (data.location) {
        setEditName(data.location.name);
        setEditType(data.location.type ?? "");
        setEditDescription(data.location.description ?? "");
        setEditParent(data.location.parent_id);
        setEditValue(data.location.value?.toString() ?? "");
        setEditIconName(data.location.icon_name ?? "");
        setEditImageFile(null);
        setRemoveImage(false);
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Location konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  const parentName = useMemo(() => {
    if (!location?.parent_id) {
      return "Root";
    }

    return allLocations.find((entry) => entry.id === location.parent_id)?.name ?? "Unbekannt";
  }, [allLocations, location]);

  async function saveLocation() {
    if (!location) {
      return;
    }

    let nextValue: number | null = null;

    try {
      nextValue = parseOptionalPrice(editValue);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Preis muss eine gültige Zahl sein.");
      return;
    }

    let uploadedImagePath: string | null = null;
    let nextImagePath = removeImage ? null : location.image_path ?? null;

    try {
      if (editImageFile) {
        uploadedImagePath = await uploadInventoryImage(editImageFile, "locations");
        nextImagePath = uploadedImagePath;
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Bild konnte nicht hochgeladen werden.");
      return;
    }

    const { error } = await supabase.rpc("update_location", {
      loc_id: location.id,
      loc_name: editName.trim(),
      loc_type: editType || null,
      parent_location: editParent,
      loc_description: editDescription.trim() || null,
      loc_icon_name: editIconName || null,
      loc_image_path: nextImagePath,
      loc_value: nextValue,
    });

    if (error) {
      if (uploadedImagePath) {
        await removeInventoryImage(uploadedImagePath);
      }
      window.alert(error.message);
      return;
    }

    if ((removeImage || uploadedImagePath) && location.image_path && location.image_path !== nextImagePath) {
      try {
        await removeInventoryImage(location.image_path);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Altes Bild konnte nicht entfernt werden.");
      }
    }

    setEditOpen(false);
    setEditImageFile(null);
    setRemoveImage(false);
    await logInventoryActivity({
      action: location.parent_id !== editParent ? "move" : "update",
      entityId: location.id,
      entityType: "location",
      title: `Location bearbeitet: ${editName.trim()}`,
      description:
        location.parent_id !== editParent
          ? `${editName.trim()} wurde in der Hierarchie verschoben.`
          : "Location-Details wurden aktualisiert.",
      metadata: {
        location_id: location.id,
        parent_id: editParent,
      },
    });
    await reloadLocationData();
  }

  async function deleteLocation() {
    if (!location) {
      return;
    }

    const { error } = await supabase.rpc("delete_location", {
      loc_id: location.id,
      strategy: deleteStrategy,
    });

    if (error) {
      window.alert(error.message);
      return;
    }

    await logInventoryActivity({
      action: "delete",
      entityId: location.id,
      entityType: "location",
      title: `Location gelöscht: ${location.name}`,
      description: `Löschstrategie: ${deleteStrategy}`,
      metadata: {
        location_id: location.id,
        delete_strategy: deleteStrategy,
      },
    });

    router.push("/");
  }

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Lade Location...</div>;
  }

  if (!location) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Location nicht gefunden.</p>
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
              alt={location.name}
              imagePath={location.image_path}
              className="h-16 w-16 rounded-3xl object-cover"
              fallback={
                <InventoryIconBadge className="h-16 w-16 rounded-3xl bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300">
                  <LocationTypeIcon type={location.type} iconName={location.icon_name} className="h-7 w-7" />
                </InventoryIconBadge>
              }
            />
            <div>
              <Link href="/" className="text-sm text-blue-600 dark:text-blue-400">
              Zurück zur Übersicht
              </Link>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                Location
              </p>
              <h1 className="text-3xl font-semibold">{location.name}</h1>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {getLocationTypeLabel(location.type)}
              </p>
              {location.icon_name ? (
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  Icon: {getMaterialIconLabel(location.icon_name)}
                </p>
              ) : null}
            </div>
          </div>

          <ActionMenu label={`Aktionen für ${location.name}`}>
            <ActionMenuButton onClick={() => setEditOpen(true)}>Bearbeiten</ActionMenuButton>
            <ActionMenuButton className="text-red-500" onClick={() => setDeleteOpen(true)}>
              Löschen
            </ActionMenuButton>
          </ActionMenu>
        </div>

        <section className="rounded-3xl bg-white p-6 shadow-sm dark:bg-gray-900">
          <div className="mb-4 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40">
            <InventoryImage
              alt={location.name}
              imagePath={location.image_path}
              className="h-64 w-full object-cover"
              fallback={
                <div className="flex h-64 w-full items-center justify-center">
                  <InventoryIconBadge className="h-20 w-20 rounded-[2rem] bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300">
                    <LocationTypeIcon type={location.type} iconName={location.icon_name} className="h-10 w-10" />
                  </InventoryIconBadge>
                </div>
              }
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <DetailField label="ID" value={location.id} />
            <DetailField label="Parent" value={parentName} />
            <DetailField label="Typ" value={getLocationTypeLabel(location.type)} />
            <DetailField
              label="Preis"
              value={location.value != null ? `${location.value} EUR` : "Nicht hinterlegt"}
            />
            <DetailField label="Erstellt" value={formatDate(location.created_at)} />
          </div>

          <div className="mt-4 rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/70">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
              Beschreibung
            </p>
            <p className="mt-2 whitespace-pre-line text-sm text-gray-700 dark:text-gray-200">
              {location.description?.trim() ? location.description : "Keine Beschreibung hinterlegt."}
            </p>
          </div>
        </section>

        <ResourceLinksManager
          entityId={location.id}
          entityType="location"
          links={links}
          onChange={reloadLocationData}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
              Untergeordnete Locations
            </p>
            <div className="mt-4 space-y-2">
              {childLocations.length > 0 ? (
                childLocations.map((child) => (
                  <Link
                    key={child.id}
                    href={`/locations/${child.id}`}
                    className="block rounded-xl bg-gray-50 px-4 py-3 text-sm transition hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700"
                  >
                    <div className="flex items-center gap-3">
                      <InventoryIconBadge className="h-10 w-10 rounded-2xl bg-white text-gray-700 dark:bg-gray-900 dark:text-gray-200">
                        <InventoryImage
                          alt={child.name}
                          imagePath={child.image_path}
                          className="h-10 w-10 rounded-2xl object-cover"
                          fallback={
                            <LocationTypeIcon type={child.type} iconName={child.icon_name} className="h-5 w-5" />
                          }
                        />
                      </InventoryIconBadge>
                      <div>
                        <div className="font-medium">{child.name}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          {getLocationTypeLabel(child.type)}
                        </div>
                        {child.icon_name ? (
                          <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                            Icon: {getMaterialIconLabel(child.icon_name)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">Keine Unter-Locations.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Items</p>
            <div className="mt-4 space-y-2">
              {items.length > 0 ? (
                items.map((item) => (
                  <Link
                    key={item.id}
                    href={`/items/${item.id}`}
                    className="block rounded-xl bg-gray-50 px-4 py-3 text-sm transition hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700"
                  >
                    <div className="flex items-center gap-3">
                      <InventoryIconBadge className="h-10 w-10 rounded-2xl bg-white text-gray-700 dark:bg-gray-900 dark:text-gray-200">
                        <InventoryImage
                          alt={item.name}
                          imagePath={item.image_path}
                          className="h-10 w-10 rounded-2xl object-cover"
                          fallback={
                            <ItemStatusIcon status={item.status ?? null} iconName={item.icon_name} className="h-5 w-5" />
                          }
                        />
                      </InventoryIconBadge>
                      <div>
                        <div className="font-medium">{item.name}</div>
                        {item.icon_name ? (
                          <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                            Icon: {getMaterialIconLabel(item.icon_name)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">Keine Items in dieser Location.</p>
              )}
            </div>
          </section>
        </div>
      </div>

      {editOpen ? (
        <Modal>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Location bearbeiten</h3>
            <Input value={editName} onChange={(event) => setEditName(event.target.value)} />
            <Select
              value={editType}
              onChange={(event) => setEditType((event.target.value as LocationType) || "")}
            >
              <option value="">Typ entfernen</option>
              {LOCATION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <IconPicker label="Icon" value={editIconName} onChange={setEditIconName} emptyLabel="Icon entfernen" />
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Preis in EUR
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="z. B. 5.00"
                value={editValue}
                onChange={(event) => setEditValue(event.target.value)}
              />
            </div>
            <ImagePicker
              label="Bild"
              currentImagePath={location.image_path}
              pendingFile={editImageFile}
              onFileChange={setEditImageFile}
              removeImage={removeImage}
              onRemoveChange={setRemoveImage}
              fallback={
                <InventoryIconBadge className="h-16 w-16 rounded-3xl bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300">
                  <LocationTypeIcon type={editType || location.type} iconName={editIconName || location.icon_name} className="h-8 w-8" />
                </InventoryIconBadge>
              }
            />
            <Select
              value={editParent ?? ""}
              onChange={(event) => setEditParent(event.target.value || null)}
            >
              <option value="">Root</option>
              {allLocations
                .filter((entry) => entry.id !== location.id)
                .map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
            </Select>
            <textarea
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
              placeholder="Beschreibung"
              className="min-h-28 w-full rounded-md border bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
            />
            <TagManager
              entityId={location.id}
              entityType="location"
              assignedTags={assignedTags}
              availableTags={availableTags}
              onChange={reloadLocationData}
            />
            <div className="flex justify-between">
              <Button onClick={() => setEditOpen(false)}>Abbrechen</Button>
              <Button variant="primary" onClick={() => void saveLocation()}>
                Speichern
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {deleteOpen ? (
        <Modal>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Location löschen</h3>
            <Select
              value={deleteStrategy}
              onChange={(event) =>
                setDeleteStrategy(event.target.value as "unpack" | "box" | "delete")
              }
            >
              <option value="unpack">unpack</option>
              <option value="box">box</option>
              <option value="delete">delete</option>
            </Select>
            <div className="flex justify-between">
              <Button onClick={() => setDeleteOpen(false)}>Abbrechen</Button>
              <Button variant="danger" onClick={() => void deleteLocation()}>
                Löschen
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
