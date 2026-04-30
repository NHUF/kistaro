import { query, queryOne, queryRows } from "@/lib/db";

type QueryFilter =
  | { type: "eq"; column: string; value: unknown }
  | { type: "not"; column: string; operator: string; value: unknown }
  | { type: "gte"; column: string; value: unknown };

type QueryOrder = {
  column: string;
  ascending: boolean;
};

export type LocalQueryRequest = {
  table: string;
  action: "select" | "insert" | "update" | "delete";
  columns?: string;
  filters: QueryFilter[];
  orders: QueryOrder[];
  limit?: number;
  maybeSingle?: boolean;
  payload?: unknown;
  options?: Record<string, unknown>;
};

const ALLOWED_TABLES = new Set([
  "locations",
  "items",
  "tags",
  "item_tags",
  "location_tags",
  "item_documents",
  "item_links",
  "inventory_templates",
  "inventory_activity_log",
  "inventory_resource_links",
]);

function assertIdentifier(value: string) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) {
    throw new Error(`Ungültiger SQL-Bezeichner: ${value}`);
  }
}

function quoteIdentifier(value: string) {
  assertIdentifier(value);
  return `"${value}"`;
}

function getTableName(table: string) {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Tabelle ist nicht freigegeben: ${table}`);
  }

  return `public.${quoteIdentifier(table)}`;
}

function getSelectColumns(columns?: string) {
  if (!columns || columns.trim() === "*") {
    return "*";
  }

  return columns
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean)
    .map((column) => {
      assertIdentifier(column);
      return quoteIdentifier(column);
    })
    .join(", ");
}

function buildWhere(filters: QueryFilter[], values: unknown[]) {
  if (!filters.length) {
    return "";
  }

  const clauses = filters.map((filter) => {
    assertIdentifier(filter.column);
    const column = quoteIdentifier(filter.column);

    if (filter.type === "eq") {
      values.push(filter.value);
      return `${column} = $${values.length}`;
    }

    if (filter.type === "gte") {
      values.push(filter.value);
      return `${column} >= $${values.length}`;
    }

    if (filter.type === "not" && filter.operator === "is" && filter.value === null) {
      return `${column} is not null`;
    }

    throw new Error("Filter wird noch nicht unterstützt.");
  });

  return ` where ${clauses.join(" and ")}`;
}

function buildOrder(orders: QueryOrder[]) {
  if (!orders.length) {
    return "";
  }

  return ` order by ${orders
    .map((order) => {
      assertIdentifier(order.column);
      return `${quoteIdentifier(order.column)} ${order.ascending ? "asc" : "desc"}`;
    })
    .join(", ")}`;
}

function normalizeRows(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload as Record<string, unknown>[];
  }

  if (payload && typeof payload === "object") {
    return [payload as Record<string, unknown>];
  }

  throw new Error("Keine Daten zum Speichern erhalten.");
}

async function selectData<T>(request: LocalQueryRequest) {
  const values: unknown[] = [];
  const tableName = getTableName(request.table);
  const countOnly = request.options?.count === "exact" && request.options?.head === true;
  const where = buildWhere(request.filters ?? [], values);
  const order = buildOrder(request.orders ?? []);
  const limit = request.limit ? ` limit ${Number(request.limit)}` : "";

  if (countOnly) {
    const row = await queryOne<{ count: string }>(
      `select count(*)::text as count from ${tableName}${where}`,
      values,
    );

    return {
      data: null as T,
      error: null,
      count: row ? Number(row.count) : 0,
    };
  }

  const rows = await queryRows<T & Record<string, unknown>>(
    `select ${getSelectColumns(request.columns)} from ${tableName}${where}${order}${limit}`,
    values,
  );

  return {
    data: (request.maybeSingle ? rows[0] ?? null : rows) as T,
    error: null,
  };
}

async function insertData<T>(request: LocalQueryRequest) {
  const rows = normalizeRows(request.payload);
  const tableName = getTableName(request.table);

  if (!rows.length) {
    return { data: [] as T, error: null };
  }

  const columns = Object.keys(rows[0]);
  columns.forEach(assertIdentifier);

  const values: unknown[] = [];
  const placeholders = rows.map((row) => {
    const rowPlaceholders = columns.map((column) => {
      values.push(row[column]);
      return `$${values.length}`;
    });

    return `(${rowPlaceholders.join(", ")})`;
  });

  const result = await query<T & Record<string, unknown>>(
    `insert into ${tableName} (${columns.map(quoteIdentifier).join(", ")}) values ${placeholders.join(", ")} returning *`,
    values,
  );

  return { data: result.rows as T, error: null };
}

async function updateData<T>(request: LocalQueryRequest) {
  const payload = normalizeRows(request.payload)[0];
  const columns = Object.keys(payload);
  const tableName = getTableName(request.table);
  const values: unknown[] = [];

  columns.forEach(assertIdentifier);

  const sets = columns.map((column) => {
    values.push(payload[column]);
    return `${quoteIdentifier(column)} = $${values.length}`;
  });

  const where = buildWhere(request.filters ?? [], values);

  if (!where) {
    throw new Error("Update ohne Filter ist nicht erlaubt.");
  }

  const result = await query<T & Record<string, unknown>>(
    `update ${tableName} set ${sets.join(", ")}${where} returning *`,
    values,
  );

  return { data: result.rows as T, error: null };
}

async function deleteData<T>(request: LocalQueryRequest) {
  const values: unknown[] = [];
  const tableName = getTableName(request.table);
  const where = buildWhere(request.filters ?? [], values);

  if (!where) {
    throw new Error("Delete ohne Filter ist nicht erlaubt.");
  }

  const result = await query<T & Record<string, unknown>>(
    `delete from ${tableName}${where} returning *`,
    values,
  );

  return { data: result.rows as T, error: null };
}

export async function executeLocalDataRequest<T = unknown>(request: LocalQueryRequest) {
  try {
    switch (request.action) {
      case "select":
        return await selectData<T>(request);
      case "insert":
        return await insertData<T>(request);
      case "update":
        return await updateData<T>(request);
      case "delete":
        return await deleteData<T>(request);
      default:
        throw new Error("Unbekannte Datenaktion.");
    }
  } catch (error) {
    return {
      data: null as T,
      error: {
        message: error instanceof Error ? error.message : "Lokale Datenanfrage fehlgeschlagen.",
      },
    };
  }
}
