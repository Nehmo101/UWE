export type StudioDateStyle = "default" | "short" | "medium";

const STUDIO_DATETIME_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatStudioDateTime(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  return STUDIO_DATETIME_FORMAT.format(date);
}

export function formatStudioDate(
  value: Date | string | number,
  style: StudioDateStyle = "default",
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (style === "default") {
    return date.toLocaleString("de-DE");
  }

  return date.toLocaleString("de-DE", {
    dateStyle: style === "short" ? "short" : "medium",
    timeStyle: "short",
  });
}

export function formatStudioDateOrDash(value: string | null | undefined): string {
  if (!value) return "—";
  return formatStudioDate(value);
}
