type QueryFilter =
  | { type: "eq"; column: string; value: unknown }
  | { type: "not"; column: string; operator: string; value: unknown }
  | { type: "gte"; column: string; value: unknown };

type QueryOrder = {
  column: string;
  ascending: boolean;
};

type LocalQueryRequest = {
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

type LocalQueryResponse<T = unknown> = {
  data: T;
  error: { message: string } | null;
  count?: number | null;
};

function createError(message: string) {
  return { data: null, error: { message } };
}

async function postJson<T>(url: string, body: unknown): Promise<LocalQueryResponse<T>> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const result = (await response.json()) as LocalQueryResponse<T>;

  if (!response.ok && !result.error) {
    return {
      data: null as T,
      error: { message: "Lokale Datenanfrage ist fehlgeschlagen." },
    };
  }

  return result;
}

class LocalQueryBuilder<T = unknown> implements PromiseLike<LocalQueryResponse<T>> {
  private request: LocalQueryRequest;

  constructor(table: string) {
    this.request = {
      table,
      action: "select",
      filters: [],
      orders: [],
    };
  }

  select(columns = "*", options?: Record<string, unknown>) {
    this.request.action = "select";
    this.request.columns = columns;
    this.request.options = options;
    return this;
  }

  insert(payload: unknown) {
    this.request.action = "insert";
    this.request.payload = payload;
    return this;
  }

  update(payload: unknown) {
    this.request.action = "update";
    this.request.payload = payload;
    return this;
  }

  delete() {
    this.request.action = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.request.filters.push({ type: "eq", column, value });
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    this.request.filters.push({ type: "not", column, operator, value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.request.filters.push({ type: "gte", column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.request.orders.push({
      column,
      ascending: options?.ascending ?? true,
    });
    return this;
  }

  limit(limit: number) {
    this.request.limit = limit;
    return this;
  }

  maybeSingle() {
    this.request.maybeSingle = true;
    return this;
  }

  async execute() {
    if (typeof window === "undefined") {
      const { executeLocalDataRequest } = await import("@/lib/local-data-server");
      return executeLocalDataRequest<T>(this.request);
    }

    return postJson<T>("/api/local-data", this.request);
  }

  then<TResult1 = LocalQueryResponse<T>, TResult2 = never>(
    onfulfilled?: ((value: LocalQueryResponse<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

class LocalStorageBucket {
  constructor(private bucket: string) {}

  getPublicUrl(path: string) {
    return {
      data: {
        publicUrl: `/api/local-storage/${encodeURIComponent(this.bucket)}/${path
          .split("/")
          .map((part) => encodeURIComponent(part))
          .join("/")}`,
      },
    };
  }

  async upload(path: string, file: File, options?: { contentType?: string; upsert?: boolean }) {
    if (typeof window === "undefined") {
      return createError("Upload ist nur im Browser-Kontext verfügbar.");
    }

    const formData = new FormData();
    formData.set("bucket", this.bucket);
    formData.set("path", path);
    formData.set("file", file);
    formData.set("contentType", options?.contentType ?? file.type ?? "application/octet-stream");

    const response = await fetch("/api/local-storage", {
      method: "POST",
      body: formData,
    });
    const result = (await response.json()) as { error?: { message: string } | null };

    return { error: result.error ?? (response.ok ? null : { message: "Upload fehlgeschlagen." }) };
  }

  async remove(paths: string[]) {
    const response = await postJson<{ removed: number }>("/api/local-storage/remove", {
      bucket: this.bucket,
      paths,
    });

    return { error: response.error };
  }
}

export const supabase = {
  // The temporary adapter intentionally defaults to any to match the loose
  // inference behavior existing Supabase UI calls relied on during migration.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from<T = any>(table: string) {
    return new LocalQueryBuilder<T>(table);
  },
  rpc<T = unknown>(name: string, params?: Record<string, unknown>) {
    if (typeof window === "undefined") {
      return import("@/lib/local-rpc-server").then(({ executeLocalRpc }) =>
        executeLocalRpc<T>(name, params ?? {}),
      );
    }

    return postJson<T>("/api/local-rpc", { name, params: params ?? {} });
  },
  storage: {
    from(bucket: string) {
      return new LocalStorageBucket(bucket);
    },
  },
};
