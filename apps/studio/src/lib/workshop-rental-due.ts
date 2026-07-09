const RETURN_DUE_PREFIX = "@returnDue:";

export function encodeRentalReturnDue(notes: string, dueDate: string | null): string {
  const withoutMeta = stripRentalReturnDue(notes);
  if (!dueDate?.trim()) return withoutMeta;
  const prefix = `${RETURN_DUE_PREFIX}${dueDate.trim()}\n`;
  return withoutMeta ? `${prefix}${withoutMeta}` : prefix;
}

export function stripRentalReturnDue(notes: string): string {
  return notes.replace(new RegExp(`^${RETURN_DUE_PREFIX}\\d{4}-\\d{2}-\\d{2}\\n?`), "").trim();
}

export function parseRentalReturnDue(notes: string): string | null {
  const match = notes.match(new RegExp(`^${RETURN_DUE_PREFIX}(\\d{4}-\\d{2}-\\d{2})`));
  return match?.[1] ?? null;
}
