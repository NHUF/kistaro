import { existsSync } from "node:fs";
import { query, queryRows } from "@/lib/db";
import { hasInvalidStoredDateValue, normalizeNullableDateValue } from "@/lib/inventory-dates";
import { resolveStoragePath } from "@/lib/local-file-storage";
import { logSystemActivity } from "@/lib/system-activity";
import type {
  IntegrityIssue,
  IntegrityLocationOption,
  IntegrityReport,
} from "@/lib/system-integrity-types";

type RepairRequest =
  | { action: "repair"; issueId: string; targetLocationId?: string | null }
  | { action: "repair_all_safe" };

function createIssueId(code: IntegrityIssue["code"], ...parts: Array<string | null | undefined>) {
  return [code, ...parts.map((part) => part ?? "null")].join(":");
}

function isRepairable(issue: IntegrityIssue) {
  return issue.repairMode !== "none";
}

export async function scanInventoryIntegrity(): Promise<IntegrityReport> {
  const [
    locations,
    itemsMissingLocation,
    locationsInvalidParent,
    itemLinksInvalid,
    itemDocumentsInvalid,
    resourceLinksInvalid,
    itemTagsInvalid,
    locationTagsInvalid,
    itemsWithPurchaseDate,
    templatesWithPurchaseDate,
  ] = await Promise.all([
    queryRows<{ id: string; name: string }>(
      `select id, name from public.locations order by name`,
    ),
    queryRows<{ id: string; name: string; location_id: string | null }>(
      `select i.id, i.name, i.location_id
       from public.items i
       left join public.locations l on l.id = i.location_id
       where i.location_id is null or l.id is null
       order by i.name`,
    ),
    queryRows<{ id: string; name: string; parent_id: string | null }>(
      `select l.id, l.name, l.parent_id
       from public.locations l
       left join public.locations p on p.id = l.parent_id
       where (l.parent_id is not null and p.id is null) or l.parent_id = l.id
       order by l.name`,
    ),
    queryRows<{ item_id: string; linked_item_id: string }>(
      `select il.item_id, il.linked_item_id
       from public.item_links il
       left join public.items source_item on source_item.id = il.item_id
       left join public.items target_item on target_item.id = il.linked_item_id
       where source_item.id is null or target_item.id is null or il.item_id = il.linked_item_id`,
    ),
    queryRows<{ id: string; item_id: string; title: string | null; file_path: string | null }>(
      `select d.id, d.item_id, d.title, d.file_path
       from public.item_documents d
       left join public.items i on i.id = d.item_id
       where i.id is null
          or coalesce(trim(d.title), '') = ''
          or coalesce(trim(d.file_path), '') = ''`,
    ),
    queryRows<{
      id: string;
      entity_type: string;
      entity_id: string;
      label: string | null;
      url: string | null;
      item_exists: string | null;
      location_exists: string | null;
      template_exists: string | null;
    }>(
      `select
         l.id,
         l.entity_type,
         l.entity_id,
         l.label,
         l.url,
         item_ref.id::text as item_exists,
         location_ref.id::text as location_exists,
         template_ref.id::text as template_exists
       from public.inventory_resource_links l
       left join public.items item_ref
         on l.entity_type = 'item' and item_ref.id = l.entity_id
       left join public.locations location_ref
         on l.entity_type = 'location' and location_ref.id = l.entity_id
       left join public.inventory_templates template_ref
         on l.entity_type = 'template' and template_ref.id = l.entity_id
       where coalesce(trim(l.label), '') = ''
          or coalesce(trim(l.url), '') = ''
          or (
            l.entity_type = 'item' and item_ref.id is null
          )
          or (
            l.entity_type = 'location' and location_ref.id is null
          )
          or (
            l.entity_type = 'template' and template_ref.id is null
          )`,
    ),
    queryRows<{ item_id: string; tag_id: string }>(
      `select it.item_id, it.tag_id
       from public.item_tags it
       left join public.items i on i.id = it.item_id
       left join public.tags t on t.id = it.tag_id
       where i.id is null or t.id is null`,
    ),
    queryRows<{ location_id: string; tag_id: string }>(
      `select lt.location_id, lt.tag_id
       from public.location_tags lt
       left join public.locations l on l.id = lt.location_id
       left join public.tags t on t.id = lt.tag_id
       where l.id is null or t.id is null`,
    ),
    queryRows<{ id: string; name: string; purchase_date: string | null }>(
      `select id, name, purchase_date
       from public.items
       where purchase_date is not null`,
    ),
    queryRows<{ id: string; name: string; item_purchase_date: string | null }>(
      `select id, name, item_purchase_date
       from public.inventory_templates
       where item_purchase_date is not null`,
    ),
  ]);

  const issues: IntegrityIssue[] = [];

  for (const item of itemsMissingLocation) {
    issues.push({
      id: createIssueId("item_missing_location", item.id),
      code: "item_missing_location",
      severity: "error",
      entityType: "item",
      entityId: item.id,
      title: `Item ohne gueltige Location: ${item.name || item.id}`,
      description: "Dieses Item verweist auf keine vorhandene Location und kann dadurch Detail- oder Uebersichtsfehler verursachen.",
      repairMode: locations.length > 0 ? "reassign_item_location" : "none",
      metadata: {
        itemId: item.id,
        currentLocationId: item.location_id,
      },
    });
  }

  for (const location of locationsInvalidParent) {
    issues.push({
      id: createIssueId("location_invalid_parent", location.id),
      code: "location_invalid_parent",
      severity: "error",
      entityType: "location",
      entityId: location.id,
      title: `Location mit ungueltigem Parent: ${location.name || location.id}`,
      description: "Die Parent-Beziehung dieser Location zeigt ins Leere oder auf sich selbst.",
      repairMode: "reset_location_parent",
      metadata: {
        locationId: location.id,
        currentParentId: location.parent_id,
      },
    });
  }

  for (const link of itemLinksInvalid) {
    issues.push({
      id: createIssueId("item_link_invalid", link.item_id, link.linked_item_id),
      code: "item_link_invalid",
      severity: "error",
      entityType: "item",
      entityId: link.item_id,
      title: "Defekte Item-Verknuepfung",
      description: "Eine Item-Verknuepfung zeigt auf ein geloeschtes Item oder verlinkt das Item auf sich selbst.",
      repairMode: "remove_relation",
      metadata: {
        itemId: link.item_id,
        linkedItemId: link.linked_item_id,
      },
    });
  }

  for (const document of itemDocumentsInvalid) {
    issues.push({
      id: createIssueId("item_document_invalid", document.id),
      code: "item_document_invalid",
      severity: "error",
      entityType: "document",
      entityId: document.id,
      title: "Defektes Item-Dokument",
      description: "Ein Dokumenteintrag ist unvollstaendig oder verweist auf kein existierendes Item.",
      repairMode: "delete_record",
      metadata: {
        documentId: document.id,
        itemId: document.item_id,
        filePath: document.file_path,
      },
    });
  }

  for (const link of resourceLinksInvalid) {
    issues.push({
      id: createIssueId("resource_link_invalid", link.id),
      code: "resource_link_invalid",
      severity: "warning",
      entityType: "link",
      entityId: link.id,
      title: "Defekter externer Link",
      description: "Ein externer Verweis ist unvollstaendig oder zeigt auf ein geloeschtes Objekt.",
      repairMode: "delete_record",
      metadata: {
        linkId: link.id,
        entityType: link.entity_type,
        entityId: link.entity_id,
      },
    });
  }

  for (const tag of itemTagsInvalid) {
    issues.push({
      id: createIssueId("item_tag_invalid", tag.item_id, tag.tag_id),
      code: "item_tag_invalid",
      severity: "warning",
      entityType: "tag",
      entityId: tag.tag_id,
      title: "Defekte Item-Tag-Zuordnung",
      description: "Eine Tag-Zuordnung verweist auf ein geloeschtes Item oder einen geloeschten Tag.",
      repairMode: "remove_relation",
      metadata: {
        itemId: tag.item_id,
        tagId: tag.tag_id,
      },
    });
  }

  for (const tag of locationTagsInvalid) {
    issues.push({
      id: createIssueId("location_tag_invalid", tag.location_id, tag.tag_id),
      code: "location_tag_invalid",
      severity: "warning",
      entityType: "tag",
      entityId: tag.tag_id,
      title: "Defekte Location-Tag-Zuordnung",
      description: "Eine Tag-Zuordnung verweist auf eine geloeschte Location oder einen geloeschten Tag.",
      repairMode: "remove_relation",
      metadata: {
        locationId: tag.location_id,
        tagId: tag.tag_id,
      },
    });
  }

  for (const item of itemsWithPurchaseDate) {
    if (!hasInvalidStoredDateValue(item.purchase_date)) {
      continue;
    }

    issues.push({
      id: createIssueId("item_purchase_date_invalid", item.id),
      code: "item_purchase_date_invalid",
      severity: "error",
      entityType: "item",
      entityId: item.id,
      title: `Item mit ungueltigem Kaufdatum: ${item.name || item.id}`,
      description: "Dieses Item hat ein Kaufdatum im falschen Format. Das kann Detailseiten und Bearbeitungsdialoge stoeren.",
      repairMode: "normalize_date",
      metadata: {
        itemId: item.id,
        purchaseDate: item.purchase_date,
      },
    });
  }

  for (const template of templatesWithPurchaseDate) {
    if (!hasInvalidStoredDateValue(template.item_purchase_date)) {
      continue;
    }

    issues.push({
      id: createIssueId("template_purchase_date_invalid", template.id),
      code: "template_purchase_date_invalid",
      severity: "warning",
      entityType: "template",
      entityId: template.id,
      title: `Vorlage mit ungueltigem Kaufdatum: ${template.name || template.id}`,
      description: "Diese Vorlage speichert ein Kaufdatum im falschen Format und sollte bereinigt werden.",
      repairMode: "normalize_date",
      metadata: {
        templateId: template.id,
        purchaseDate: template.item_purchase_date,
      },
    });
  }

  const issueList = issues.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === "error" ? -1 : 1;
    }

    return a.title.localeCompare(b.title, "de");
  });

  return {
    checkedAt: new Date().toISOString(),
    issueCount: issueList.length,
    repairableCount: issueList.filter(isRepairable).length,
    issues: issueList,
    locations: locations as IntegrityLocationOption[],
  };
}

async function repairIssue(issue: IntegrityIssue, targetLocationId?: string | null) {
  switch (issue.code) {
    case "item_missing_location": {
      if (!targetLocationId) {
        throw new Error("Bitte eine gueltige Ziel-Location waehlen.");
      }

      await query(`update public.items set location_id = $1 where id = $2`, [
        targetLocationId,
        issue.entityId,
      ]);
      return `Item wurde einer gueltigen Location zugeordnet.`;
    }
    case "location_invalid_parent": {
      await query(`update public.locations set parent_id = null where id = $1`, [issue.entityId]);
      return "Ungueltiger Parent wurde entfernt.";
    }
    case "item_link_invalid": {
      await query(
        `delete from public.item_links where item_id = $1 and linked_item_id = $2`,
        [issue.metadata?.itemId, issue.metadata?.linkedItemId],
      );
      return "Defekte Item-Verknuepfung wurde entfernt.";
    }
    case "item_document_invalid": {
      await query(`delete from public.item_documents where id = $1`, [issue.entityId]);

      const filePath = issue.metadata?.filePath;
      if (filePath) {
        const absolutePath = resolveStoragePath("inventory-documents", filePath);
        if (existsSync(absolutePath)) {
          // intentionally left in place: if the record was broken we do not force-delete the file here
        }
      }

      return "Defekter Dokumenteintrag wurde entfernt.";
    }
    case "resource_link_invalid": {
      await query(`delete from public.inventory_resource_links where id = $1`, [issue.entityId]);
      return "Defekter externer Link wurde entfernt.";
    }
    case "item_tag_invalid": {
      await query(`delete from public.item_tags where item_id = $1 and tag_id = $2`, [
        issue.metadata?.itemId,
        issue.metadata?.tagId,
      ]);
      return "Defekte Item-Tag-Zuordnung wurde entfernt.";
    }
    case "location_tag_invalid": {
      await query(`delete from public.location_tags where location_id = $1 and tag_id = $2`, [
        issue.metadata?.locationId,
        issue.metadata?.tagId,
      ]);
      return "Defekte Location-Tag-Zuordnung wurde entfernt.";
    }
    case "item_purchase_date_invalid": {
      await query(`update public.items set purchase_date = $1 where id = $2`, [
        normalizeNullableDateValue(issue.metadata?.purchaseDate),
        issue.entityId,
      ]);
      return "Kaufdatum des Items wurde bereinigt.";
    }
    case "template_purchase_date_invalid": {
      await query(`update public.inventory_templates set item_purchase_date = $1 where id = $2`, [
        normalizeNullableDateValue(issue.metadata?.purchaseDate),
        issue.entityId,
      ]);
      return "Kaufdatum der Vorlage wurde bereinigt.";
    }
    default:
      throw new Error("Dieser Defekt kann aktuell nicht automatisch repariert werden.");
  }
}

export async function repairInventoryIntegrity(request: RepairRequest) {
  const report = await scanInventoryIntegrity();

  if (request.action === "repair_all_safe") {
    const safeIssues = report.issues.filter(
      (issue) => issue.repairMode !== "reassign_item_location" && issue.repairMode !== "none",
    );

    if (safeIssues.length === 0) {
      return { message: "Keine sicher reparierbaren Defekte gefunden." };
    }

    for (const issue of safeIssues) {
      await repairIssue(issue, null);
    }

    await logSystemActivity({
      title: "Integritaetsreparatur ausgefuehrt",
      description: `${safeIssues.length} sicher reparierbare Defekte wurden bereinigt.`,
      metadata: {
        repaired_issue_count: safeIssues.length,
      },
    });

    return { message: `${safeIssues.length} Defekte wurden automatisch repariert.` };
  }

  const issue = report.issues.find((entry) => entry.id === request.issueId);

  if (!issue) {
    throw new Error("Der ausgewaehlte Defekt wurde nicht mehr gefunden. Bitte erneut pruefen.");
  }

  const message = await repairIssue(issue, request.targetLocationId ?? null);

  await logSystemActivity({
    title: "Integritaetsproblem repariert",
    description: issue.title,
    metadata: {
      issue_id: issue.id,
      issue_code: issue.code,
      target_location_id: request.targetLocationId ?? null,
    },
  });

  return { message };
}
