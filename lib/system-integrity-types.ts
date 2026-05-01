export type IntegrityIssueSeverity = "error" | "warning";

export type IntegrityRepairMode =
  | "remove_relation"
  | "delete_record"
  | "reassign_item_location"
  | "reset_location_parent"
  | "none";

export type IntegrityIssue = {
  id: string;
  code:
    | "item_missing_location"
    | "location_invalid_parent"
    | "item_link_invalid"
    | "item_document_invalid"
    | "resource_link_invalid"
    | "item_tag_invalid"
    | "location_tag_invalid";
  severity: IntegrityIssueSeverity;
  entityType: "item" | "location" | "document" | "link" | "tag" | "system";
  entityId: string;
  title: string;
  description: string;
  repairMode: IntegrityRepairMode;
  metadata?: Record<string, string | null>;
};

export type IntegrityLocationOption = {
  id: string;
  name: string;
};

export type IntegrityReport = {
  checkedAt: string;
  issueCount: number;
  repairableCount: number;
  issues: IntegrityIssue[];
  locations: IntegrityLocationOption[];
};
