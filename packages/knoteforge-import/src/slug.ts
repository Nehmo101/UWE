const SLUG_MAX_LENGTH = 60;

export function slugifyTitle(title: string): string {
  return title
    .toLocaleLowerCase("de")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, SLUG_MAX_LENGTH);
}

export function resolveUniqueSlug(
  desiredSlug: string,
  takenSlugs: ReadonlySet<string>,
): string {
  const base = desiredSlug || "import";
  if (!takenSlugs.has(base)) {
    return base;
  }

  for (let i = 2; i < 1000; i++) {
    const suffix = `-${i}`;
    const candidate = `${base.slice(0, SLUG_MAX_LENGTH - suffix.length)}${suffix}`;
    if (!takenSlugs.has(candidate)) {
      return candidate;
    }
  }

  return `${base.slice(0, 40)}-${Date.now()}`;
}

export function normalizeLookupKey(value: string): string {
  return value.trim().toLocaleLowerCase("de");
}
