import { db } from "@/lib/db";
import { removeStorageFile } from "@/lib/local-file-storage";
import { INVENTORY_DOCUMENT_BUCKET, INVENTORY_MEDIA_BUCKET } from "@/lib/inventory-media";
import { logSystemActivity } from "@/lib/system-activity";

type ResetInventoryOptions = {
  deleteTemplates: boolean;
};

type FileTarget = {
  bucket: string;
  path: string;
};

type ResetInventoryResult = {
  deletedFiles: number;
  deleteTemplates: boolean;
  failedFiles: string[];
};

function normalizeFilePath(path: unknown) {
  return typeof path === "string" && path.trim() ? path.trim() : null;
}

async function collectStorageTargets(deleteTemplates: boolean) {
  const targets: FileTarget[] = [];

  const itemImages = await db.query<{ image_path: string | null }>(
    "select image_path from public.items where image_path is not null",
  );
  const locationImages = await db.query<{ image_path: string | null }>(
    "select image_path from public.locations where image_path is not null",
  );
  const documents = await db.query<{ file_path: string | null }>(
    "select file_path from public.item_documents where file_path is not null",
  );

  for (const row of [...itemImages.rows, ...locationImages.rows]) {
    const path = normalizeFilePath(row.image_path);

    if (path) {
      targets.push({ bucket: INVENTORY_MEDIA_BUCKET, path });
    }
  }

  for (const row of documents.rows) {
    const path = normalizeFilePath(row.file_path);

    if (path) {
      targets.push({ bucket: INVENTORY_DOCUMENT_BUCKET, path });
    }
  }

  if (deleteTemplates) {
    const templateImages = await db.query<{ image_path: string | null }>(
      "select image_path from public.inventory_templates where image_path is not null",
    );

    for (const row of templateImages.rows) {
      const path = normalizeFilePath(row.image_path);

      if (path) {
        targets.push({ bucket: INVENTORY_MEDIA_BUCKET, path });
      }
    }
  }

  return targets.filter(
    (target, index, list) =>
      list.findIndex((candidate) => candidate.bucket === target.bucket && candidate.path === target.path) === index,
  );
}

async function clearInventoryData(deleteTemplates: boolean) {
  const client = await db.connect();

  try {
    await client.query("begin");
    await client.query("delete from public.inventory_resource_links where entity_type in ('item', 'location')");
    await client.query("delete from public.item_links");
    await client.query("delete from public.item_documents");
    await client.query("delete from public.item_tags");
    await client.query("delete from public.location_tags");
    await client.query("delete from public.items");
    await client.query("delete from public.locations");
    await client.query("delete from public.tags");

    if (deleteTemplates) {
      await client.query("delete from public.inventory_resource_links where entity_type = 'template'");
      await client.query("delete from public.inventory_templates");
    }

    await client.query("delete from public.inventory_activity_log");
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function removeStorageTargets(targets: FileTarget[]) {
  const failedFiles: string[] = [];
  let deletedFiles = 0;

  for (const target of targets) {
    try {
      if (removeStorageFile(target.bucket, target.path)) {
        deletedFiles += 1;
      }
    } catch {
      failedFiles.push(`${target.bucket}/${target.path}`);
    }
  }

  return { deletedFiles, failedFiles };
}

export async function resetInventorySystem({ deleteTemplates }: ResetInventoryOptions): Promise<ResetInventoryResult> {
  const storageTargets = await collectStorageTargets(deleteTemplates);

  await clearInventoryData(deleteTemplates);
  const { deletedFiles, failedFiles } = removeStorageTargets(storageTargets);

  await logSystemActivity({
    title: "System zurückgesetzt",
    description: deleteTemplates
      ? "Inventar, Tags, Vorlagen und lokale Dateien wurden geleert."
      : "Inventar, Tags und lokale Dateien wurden geleert. Vorlagen wurden behalten.",
    metadata: {
      delete_templates: deleteTemplates,
      deleted_files: deletedFiles,
      failed_files: failedFiles,
      reset_at: new Date().toISOString(),
    },
  });

  return {
    deletedFiles,
    deleteTemplates,
    failedFiles,
  };
}
