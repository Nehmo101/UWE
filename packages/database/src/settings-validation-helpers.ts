export const UNSAFE_PATH_PATTERNS = [
  /\0/,
  /\.\./,
  /[<>"|*?]/,
  /^\s*\/etc\b/i,
  /^\s*\/proc\b/i,
  /^\s*\/sys\b/i,
  /^\s*\/dev\b/i,
  /^\s*C:\\Windows\b/i,
];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function collectUnknownKeys(
  obj: Record<string, unknown>,
  allowed: Set<string>,
  path: string,
): string[] {
  const errors: string[] = [];
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      errors.push(`Unbekannter Schlüssel: ${path}.${key}`);
    }
  }
  return errors;
}

export function requireBoolean(
  value: unknown,
  path: string,
  errors: string[],
): value is boolean {
  if (typeof value !== "boolean") {
    errors.push(`${path} muss ein Boolean sein.`);
    return false;
  }
  return true;
}

export function requireEnum<T extends string>(
  value: unknown,
  allowed: Set<T>,
  path: string,
  errors: string[],
): value is T {
  if (typeof value !== "string" || !allowed.has(value as T)) {
    const options = [...allowed].join(", ");
    errors.push(`${path} muss einer der Werte sein: ${options}.`);
    return false;
  }
  return true;
}

export function requireSafePathString(
  value: unknown,
  path: string,
  errors: string[],
): value is string {
  if (typeof value !== "string") {
    errors.push(`${path} muss ein String sein.`);
    return false;
  }

  for (const pattern of UNSAFE_PATH_PATTERNS) {
    if (pattern.test(value)) {
      errors.push(`${path} enthält einen nicht zulässigen Pfadwert.`);
      return false;
    }
  }

  return true;
}

export function validateSection(
  section: unknown,
  allowedKeys: Set<string>,
  path: string,
  validateField: (key: string, value: unknown, errors: string[]) => void,
): string[] {
  if (!isRecord(section)) {
    return [`${path} muss ein Objekt sein.`];
  }

  const errors = collectUnknownKeys(section, allowedKeys, path);
  for (const [key, value] of Object.entries(section)) {
    if (allowedKeys.has(key)) {
      validateField(key, value, errors);
    }
  }
  return errors;
}

export function normalizeHiddenNavIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const ids = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && entry.length <= 80);
  return [...new Set(ids)].slice(0, 150);
}

export function parseHiddenNavIdsUpdate(
  value: unknown,
  errors: string[],
): string[] | undefined {
  if (!Array.isArray(value)) {
    errors.push("settings.app.hiddenNavIds muss ein Array von Strings sein.");
    return undefined;
  }
  const ids = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && entry.length <= 80);
  if (ids.length > 150) {
    errors.push("settings.app.hiddenNavIds darf höchstens 150 Einträge haben.");
    return undefined;
  }
  return [...new Set(ids)];
}
