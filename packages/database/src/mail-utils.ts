import { slugifyKey } from "./slug-utils";

export function slugifyMailKey(value: string, fallback: string): string {
  return slugifyKey(value, fallback, { maxLength: 80 });
}

export function renderMailTemplate(
  template: string,
  variables: Record<string, string | number | null | undefined>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = variables[key];
    if (value == null) {
      return "";
    }
    return String(value);
  });
}
