function toDateInputString(value: unknown) {
  if (value == null || value === "") {
    return "";
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return "";
    }

    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
      return "";
    }

    return parsedDate.toISOString().slice(0, 10);
  }

  return "";
}

export function normalizeDateInputValue(value?: unknown) {
  const normalizedSource = toDateInputString(value);

  if (!normalizedSource) {
    return "";
  }

  const directMatch = normalizedSource.match(/^(\d{4}-\d{2}-\d{2})/);

  if (directMatch) {
    return directMatch[1];
  }

  const parsedDate = new Date(normalizedSource);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toISOString().slice(0, 10);
}

export function normalizeNullableDateValue(value?: unknown) {
  const normalizedValue = normalizeDateInputValue(value);
  return normalizedValue || null;
}

export function hasInvalidStoredDateValue(value?: unknown) {
  const normalizedSource = toDateInputString(value);
  return normalizedSource !== "" && normalizeDateInputValue(value) === "";
}

export function formatInventoryDate(value?: unknown) {
  const normalizedValue = normalizeDateInputValue(value);

  if (!normalizedValue) {
    return "-";
  }

  const parsedDate = new Date(`${normalizedValue}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return normalizedValue;
  }

  return parsedDate.toLocaleDateString("de-DE");
}
