"use client";

const STORAGE_KEY = "uwe:nav:hidden-ids";

export function readHiddenNavIds(): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((entry): entry is string => typeof entry === "string"));
  } catch {
    return new Set();
  }
}

export function writeHiddenNavIds(ids: Set<string>): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export function toggleHiddenNavId(id: string, hidden: boolean): Set<string> {
  const next = readHiddenNavIds();
  if (hidden) {
    next.add(id);
  } else {
    next.delete(id);
  }
  writeHiddenNavIds(next);
  window.dispatchEvent(new CustomEvent("uwe:nav-visibility-changed"));
  return next;
}
