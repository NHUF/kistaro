import { supabase } from "@/lib/supabase";

export function normalizeTagNames(tagNames: string[]) {
  const normalizedTags: string[] = [];

  for (const tagName of tagNames) {
    const normalizedTag = tagName.trim();

    if (!normalizedTag) {
      continue;
    }

    if (normalizedTags.some((existingTag) => existingTag.toLowerCase() === normalizedTag.toLowerCase())) {
      continue;
    }

    normalizedTags.push(normalizedTag);
  }

  return normalizedTags;
}

function isDuplicateTagError(message: string) {
  const normalizedMessage = message.toLowerCase();
  return normalizedMessage.includes("duplicate") || normalizedMessage.includes("unique");
}

export async function ensureInventoryTagsExist(tagNames: string[]) {
  const normalizedTags = normalizeTagNames(tagNames);

  if (!normalizedTags.length) {
    return normalizedTags;
  }

  const { data, error } = await supabase.from<Array<{ id: string; name: string }>>("tags").select("id, name");

  if (error) {
    throw new Error(error.message);
  }

  const existingTags = new Set((data ?? []).map((tag) => tag.name.toLowerCase()));

  for (const tagName of normalizedTags) {
    if (existingTags.has(tagName.toLowerCase())) {
      continue;
    }

    const { error: insertError } = await supabase.from("tags").insert({ name: tagName });

    if (insertError && !isDuplicateTagError(insertError.message)) {
      throw new Error(insertError.message);
    }

    existingTags.add(tagName.toLowerCase());
  }

  return normalizedTags;
}

export function mergeTagNames(currentTags: string[], nextTags: string[]) {
  return normalizeTagNames([...currentTags, ...nextTags]);
}
