import { redirect } from "next/navigation";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Legacy DM dashboard URL — canonical Studio landing is /today (IA consolidation).
 * Preserves query string for deep links (e.g. ?world=…).
 */
export default async function StudioDashboardRedirect({ searchParams }: Props) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
  }
  const query = qs.toString();
  redirect(query ? `/today?${query}` : "/today");
}
