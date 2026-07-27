import { redirect } from "next/navigation";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Legacy DM dashboard URL — die kanonische Studio-Landung ist die Welten-Liste.
 * Query-String bleibt für Deep Links erhalten (z. B. ?world=…).
 */
export default async function StudioDashboardRedirect({ searchParams }: Props) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
  }
  const query = qs.toString();
  redirect(query ? `/worlds?${query}` : "/worlds");
}
