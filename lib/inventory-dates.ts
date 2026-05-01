export function normalizeDateInputValue(value?: string | null) {
  if (!value) {
    return "";
  }

  const trimmedValue = value.trim();
  const directMatch = trimmedValue.match(/^(\d{4}-\d{2}-\d{2})/);

  if (directMatch) {
    return directMatch[1];
  }

  const parsedDate = new Date(trimmedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toISOString().slice(0, 10);
}

export function normalizeNullableDateValue(value?: string | null) {
  const normalizedValue = normalizeDateInputValue(value);
  return normalizedValue || null;
}

export function hasInvalidStoredDateValue(value?: string | null) {
  return value != null && value.trim() !== "" && normalizeDateInputValue(value) === "";
}

export function formatInventoryDate(value?: string | null) {
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
