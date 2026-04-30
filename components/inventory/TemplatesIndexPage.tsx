"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FloatingCreateButton } from "@/components/inventory/FloatingCreateButton";
import { IconPicker } from "@/components/inventory/IconPicker";
import { ImagePicker } from "@/components/inventory/ImagePicker";
import { InventoryImage } from "@/components/inventory/InventoryImage";
import {
  InventoryIconBadge,
  ItemStatusIcon,
  LocationTypeIcon,
  getMaterialIconLabel,
} from "@/components/inventory/InventoryIcon";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import {
  ITEM_STATUS_OPTIONS,
  LOCATION_TYPE_OPTIONS,
  getItemStatusLabel,
  getLocationTypeLabel,
  type ItemStatus,
  type LocationType,
} from "@/lib/inventory";
import type { InventoryTemplateRecord } from "@/lib/inventory-data";
import { removeInventoryImage, uploadInventoryImage } from "@/lib/inventory-media";
import { logInventoryActivity } from "@/lib/inventory-activity";
import { supabase } from "@/lib/supabase";

type TemplateFormState = {
  entityType: "item" | "location";
  baseName: string;
  description: string;
  locationType: LocationType | "";
  itemStatus: ItemStatus | "";
  iconName: string;
  imageFile: File | null;
  removeImage: boolean;
  itemValue: string;
  itemPurchaseDate: string;
  locationValue: string;
};

const EMPTY_FORM: TemplateFormState = {
  entityType: "item",
  baseName: "",
  description: "",
  locationType: "",
  itemStatus: "",
  iconName: "",
  imageFile: null,
  removeImage: false,
  itemValue: "",
  itemPurchaseDate: "",
  locationValue: "",
};

function getBaseName(name: string) {
  return name.replace(/-0000$/, "");
}

function getTemplateName(baseName: string) {
  return `${baseName.trim().replace(/-0000$/, "")}-0000`;
}

function getEntityLabel(entityType: "item" | "location") {
  return entityType === "item" ? "Item-Vorlage" : "Location-Vorlage";
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

function isUnknownLocationValueColumn(errorMessage: string) {
  return errorMessage.includes("location_value") && errorMessage.toLowerCase().includes("column");
}

export function TemplatesIndexPage({
  initialQuery = "",
  templates: initialTemplates,
}: {
  initialQuery?: string;
  templates: InventoryTemplateRecord[];
}) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [query, setQuery] = useState(initialQuery);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<InventoryTemplateRecord | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<InventoryTemplateRecord | null>(null);
  const [form, setForm] = useState<TemplateFormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return templates;
    }

    return templates.filter((template) => {
      return (
        template.name.toLowerCase().includes(normalizedQuery) ||
        (template.description ?? "").toLowerCase().includes(normalizedQuery) ||
        getEntityLabel(template.entity_type).toLowerCase().includes(normalizedQuery) ||
        getLocationTypeLabel(template.location_type).toLowerCase().includes(normalizedQuery) ||
        getItemStatusLabel(template.item_status).toLowerCase().includes(normalizedQuery)
      );
    });
  }, [templates, query]);

  async function reloadTemplates() {
    const { data, error } = await supabase
      .from<InventoryTemplateRecord[]>("inventory_templates")
      .select("*")
      .order("entity_type")
      .order("name");

    if (error) {
      window.alert(error.message);
      return;
    }

    setTemplates((data ?? []) as InventoryTemplateRecord[]);
  }

  async function insertTemplate(payload: Partial<InventoryTemplateRecord>) {
    const response = await supabase.from<InventoryTemplateRecord[]>("inventory_templates").insert(payload);

    if (response.error && isUnknownLocationValueColumn(response.error.message)) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.location_value;
      return supabase.from<InventoryTemplateRecord[]>("inventory_templates").insert(fallbackPayload);
    }

    return response;
  }

  async function updateTemplateRow(templateId: string, payload: Partial<InventoryTemplateRecord>) {
    const response = await supabase
      .from<InventoryTemplateRecord[]>("inventory_templates")
      .update(payload)
      .eq("id", templateId);

    if (response.error && isUnknownLocationValueColumn(response.error.message)) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.location_value;
      return supabase
        .from<InventoryTemplateRecord[]>("inventory_templates")
        .update(fallbackPayload)
        .eq("id", templateId);
    }

    return response;
  }

  function updateForm(patch: Partial<TemplateFormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  function openCreateModal() {
    resetForm();
    setCreateOpen(true);
  }

  function openEditModal(template: InventoryTemplateRecord) {
    setEditTemplate(template);
    setForm({
      entityType: template.entity_type,
      baseName: getBaseName(template.name),
      description: template.description ?? "",
      locationType: template.location_type ?? "",
      itemStatus: template.item_status ?? "",
      iconName: template.icon_name ?? "",
      imageFile: null,
      removeImage: false,
      itemValue: template.item_value?.toString() ?? "",
      itemPurchaseDate: template.item_purchase_date ?? "",
      locationValue: template.location_value?.toString() ?? "",
    });
  }

  async function createTemplate() {
    if (!form.baseName.trim()) {
      window.alert("Name für die Vorlage ist erforderlich.");
      return;
    }

    setBusy(true);
    let uploadedImagePath: string | null = null;

    try {
      if (form.imageFile) {
        uploadedImagePath = await uploadInventoryImage(
          form.imageFile,
          form.entityType === "item" ? "items" : "locations"
        );
      }

      let nextItemValue: number | null = null;
      let nextLocationValue: number | null = null;

      try {
        nextItemValue = form.entityType === "item" ? parseOptionalPrice(form.itemValue) : null;
        nextLocationValue = form.entityType === "location" ? parseOptionalPrice(form.locationValue) : null;
      } catch (error) {
        if (uploadedImagePath) {
          await removeInventoryImage(uploadedImagePath);
        }
        window.alert(error instanceof Error ? error.message : "Preis muss eine gültige Zahl sein.");
        return;
      }

      const { error } = await insertTemplate({
        entity_type: form.entityType,
        name: getTemplateName(form.baseName),
        description: form.description.trim() || null,
        location_type: form.entityType === "location" ? form.locationType || null : null,
        item_status: form.entityType === "item" ? form.itemStatus || null : null,
        icon_name: form.iconName || null,
        image_path: uploadedImagePath,
        item_value: form.entityType === "item" ? nextItemValue : null,
        item_purchase_date: form.entityType === "item" ? form.itemPurchaseDate || null : null,
        location_value: form.entityType === "location" ? nextLocationValue : null,
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
        title: `Vorlage erstellt: ${form.baseName.trim()}-0000`,
        description: `${getEntityLabel(form.entityType)} wurde angelegt.`,
        metadata: {
          entity_type: form.entityType,
        },
      });

      setCreateOpen(false);
      resetForm();
      await reloadTemplates();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function updateTemplate() {
    if (!editTemplate || !form.baseName.trim()) {
      return;
    }

    setBusy(true);
    let uploadedImagePath: string | null = null;
    let nextImagePath = form.removeImage ? null : editTemplate.image_path ?? null;

    try {
      if (form.imageFile) {
        uploadedImagePath = await uploadInventoryImage(
          form.imageFile,
          form.entityType === "item" ? "items" : "locations"
        );
        nextImagePath = uploadedImagePath;
      }

      let nextItemValue: number | null = null;
      let nextLocationValue: number | null = null;

      try {
        nextItemValue = form.entityType === "item" ? parseOptionalPrice(form.itemValue) : null;
        nextLocationValue = form.entityType === "location" ? parseOptionalPrice(form.locationValue) : null;
      } catch (error) {
        if (uploadedImagePath) {
          await removeInventoryImage(uploadedImagePath);
        }
        window.alert(error instanceof Error ? error.message : "Preis muss eine gültige Zahl sein.");
        return;
      }

      const { error } = await updateTemplateRow(editTemplate.id, {
        name: getTemplateName(form.baseName),
        description: form.description.trim() || null,
        location_type: form.entityType === "location" ? form.locationType || null : null,
        item_status: form.entityType === "item" ? form.itemStatus || null : null,
        icon_name: form.iconName || null,
        image_path: nextImagePath,
        item_value: form.entityType === "item" ? nextItemValue : null,
        item_purchase_date: form.entityType === "item" ? form.itemPurchaseDate || null : null,
        location_value: form.entityType === "location" ? nextLocationValue : null,
      });

      if (error) {
        if (uploadedImagePath) {
          await removeInventoryImage(uploadedImagePath);
        }
        window.alert(error.message);
        return;
      }

      if (
        (form.removeImage || uploadedImagePath) &&
        editTemplate.image_path &&
        editTemplate.image_path !== nextImagePath
      ) {
        await removeInventoryImage(editTemplate.image_path);
      }

      setEditTemplate(null);
      resetForm();
      await logInventoryActivity({
        action: "update",
        entityId: editTemplate.id,
        entityType: "template",
        title: `Vorlage bearbeitet: ${form.baseName.trim()}-0000`,
        description: "Vorlagen-Details wurden aktualisiert.",
        metadata: {
          template_id: editTemplate.id,
        },
      });
      await reloadTemplates();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeTemplate() {
    if (!deleteTemplate) {
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase
        .from<InventoryTemplateRecord[]>("inventory_templates")
        .delete()
        .eq("id", deleteTemplate.id);

      if (error) {
        window.alert(error.message);
        return;
      }

      if (deleteTemplate.image_path) {
        await removeInventoryImage(deleteTemplate.image_path);
      }

      await logInventoryActivity({
        action: "delete",
        entityId: deleteTemplate.id,
        entityType: "template",
        title: `Vorlage gelöscht: ${deleteTemplate.name}`,
        description: "Vorlage wurde entfernt.",
        metadata: {
          template_id: deleteTemplate.id,
        },
      });

      setDeleteTemplate(null);
      await reloadTemplates();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 px-3 py-4 text-gray-800 dark:bg-gray-950 dark:text-gray-100 sm:px-4 lg:px-6">
      <div className="mx-auto max-w-6xl space-y-4 lg:space-y-6">
        <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-end sm:justify-between dark:border-gray-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
              Zugriff
            </p>
            <h1 className="text-3xl font-semibold">Vorlagen</h1>
          </div>
          <div className="inline-flex rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            {filteredTemplates.length} sichtbar
          </div>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:p-5">
          <label className="mb-2 block text-sm font-medium text-gray-600 dark:text-gray-300">
            Vorlagen durchsuchen
          </label>
          <Input
            placeholder="Name, Typ, Status oder Beschreibung"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          {filteredTemplates.map((template) => (
            <article
              key={template.id}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-3">
                  <InventoryImage
                    alt={template.name}
                    imagePath={template.image_path}
                    className="h-14 w-14 rounded-2xl object-cover"
                    fallback={
                      <InventoryIconBadge className="h-14 w-14 rounded-2xl bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300">
                        {template.entity_type === "item" ? (
                          <ItemStatusIcon
                            status={template.item_status}
                            iconName={template.icon_name}
                            className="h-5 w-5"
                          />
                        ) : (
                          <LocationTypeIcon
                            type={template.location_type}
                            iconName={template.icon_name}
                            className="h-5 w-5"
                          />
                        )}
                      </InventoryIconBadge>
                    }
                  />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                      {getEntityLabel(template.entity_type)}
                    </p>
                    <h2 className="mt-2 text-lg font-semibold">{template.name}</h2>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      {template.entity_type === "item"
                        ? getItemStatusLabel(template.item_status)
                        : getLocationTypeLabel(template.location_type)}
                    </p>
                    {template.icon_name ? (
                      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        Icon: {getMaterialIconLabel(template.icon_name)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-row gap-2 lg:flex-col">
                  <Button variant="ghost" onClick={() => openEditModal(template)}>
                    Bearbeiten
                  </Button>
                  <Button variant="danger" onClick={() => setDeleteTemplate(template)}>
                    Löschen
                  </Button>
                </div>
              </div>

              <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
                {template.description?.trim() || "Keine Beschreibung"}
              </p>

              {template.entity_type === "item" && (template.item_value != null || template.item_purchase_date) ? (
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-400">
                  {template.item_value != null ? (
                    <span className="rounded-full bg-gray-100 px-3 py-2 dark:bg-gray-800">
                      Preis: {template.item_value} EUR
                    </span>
                  ) : null}
                  {template.item_purchase_date ? (
                    <span className="rounded-full bg-gray-100 px-3 py-2 dark:bg-gray-800">
                      Kaufdatum: {template.item_purchase_date}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {template.entity_type === "location" && template.location_value != null ? (
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-400">
                  <span className="rounded-full bg-gray-100 px-3 py-2 dark:bg-gray-800">
                    Preis: {template.location_value} EUR
                  </span>
                </div>
              ) : null}
            </article>
          ))}
        </section>
      </div>

      <FloatingCreateButton ariaLabel="Neue Vorlage anlegen" onClick={openCreateModal} />

      {createOpen ? (
        <TemplateModal
          busy={busy}
          form={form}
          onCancel={() => {
            setCreateOpen(false);
            resetForm();
          }}
          onChange={updateForm}
          onSubmit={() => void createTemplate()}
          title="Vorlage anlegen"
        />
      ) : null}

      {editTemplate ? (
        <TemplateModal
          busy={busy}
          currentImagePath={editTemplate.image_path}
          form={form}
          lockEntityType
          onCancel={() => {
            setEditTemplate(null);
            resetForm();
          }}
          onChange={updateForm}
          onSubmit={() => void updateTemplate()}
          title="Vorlage bearbeiten"
        />
      ) : null}

      {deleteTemplate ? (
        <Modal>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Vorlage löschen</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {deleteTemplate.name} wird dauerhaft entfernt.
            </p>
            <div className="flex justify-between">
              <Button onClick={() => setDeleteTemplate(null)}>Abbrechen</Button>
              <Button variant="danger" onClick={() => void removeTemplate()} disabled={busy}>
                Löschen
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function TemplateModal({
  busy,
  currentImagePath = null,
  form,
  lockEntityType = false,
  onCancel,
  onChange,
  onSubmit,
  title,
}: {
  busy: boolean;
  currentImagePath?: string | null;
  form: TemplateFormState;
  lockEntityType?: boolean;
  onCancel: () => void;
  onChange: (patch: Partial<TemplateFormState>) => void;
  onSubmit: () => void;
  title: string;
}) {
  return (
    <Modal>
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        {lockEntityType ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
            Typ: <span className="font-medium">{getEntityLabel(form.entityType)}</span>
          </div>
        ) : (
          <Select
            value={form.entityType}
            onChange={(event) =>
              onChange({
                entityType: event.target.value as "item" | "location",
                locationType: "",
                itemStatus: "",
                itemValue: "",
                itemPurchaseDate: "",
                locationValue: "",
              })
            }
          >
            <option value="item">Item-Vorlage</option>
            <option value="location">Location-Vorlage</option>
          </Select>
        )}
        <Input
          placeholder="Vorlagenname"
          value={form.baseName}
          onChange={(event) => onChange({ baseName: event.target.value })}
        />
        <Input
          placeholder="Beschreibung"
          value={form.description}
          onChange={(event) => onChange({ description: event.target.value })}
        />

        {form.entityType === "location" ? (
          <>
            <Select
              value={form.locationType}
              onChange={(event) => onChange({ locationType: (event.target.value as LocationType) || "" })}
            >
              <option value="">Typ offen lassen</option>
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
              value={form.locationValue}
              onChange={(event) => onChange({ locationValue: event.target.value })}
            />
          </>
        ) : (
          <>
            <Select
              value={form.itemStatus}
              onChange={(event) => onChange({ itemStatus: (event.target.value as ItemStatus) || "" })}
            >
              <option value="">Status offen lassen</option>
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
              value={form.itemValue}
              onChange={(event) => onChange({ itemValue: event.target.value })}
            />
            <Input
              type="date"
              value={form.itemPurchaseDate}
              onChange={(event) => onChange({ itemPurchaseDate: event.target.value })}
            />
          </>
        )}

        <IconPicker
          label="Icon"
          value={form.iconName}
          onChange={(nextValue) => onChange({ iconName: nextValue })}
          emptyLabel="Kein fixes Icon"
        />
        <ImagePicker
          label="Vorlagenbild"
          currentImagePath={currentImagePath}
          pendingFile={form.imageFile}
          onFileChange={(nextFile) => onChange({ imageFile: nextFile })}
          removeImage={form.removeImage}
          onRemoveChange={(remove) => onChange({ removeImage: remove })}
          fallback={
            <InventoryIconBadge className="h-16 w-16 rounded-3xl bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300">
              {form.entityType === "item" ? (
                <ItemStatusIcon status={form.itemStatus || null} iconName={form.iconName || null} className="h-8 w-8" />
              ) : (
                <LocationTypeIcon type={form.locationType || null} iconName={form.iconName || null} className="h-8 w-8" />
              )}
            </InventoryIconBadge>
          }
        />
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-400">
          Der Name wird serverseitig immer als Vorlage gespeichert und automatisch mit <code>-0000</code> abgeschlossen.
        </div>
        <div className="flex justify-between">
          <Button onClick={onCancel}>Abbrechen</Button>
          <Button variant="primary" onClick={onSubmit} disabled={busy}>
            {busy ? "Speichert..." : "Speichern"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
