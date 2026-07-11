import Link from "next/link";

export function SystemHubBanner() {
  return (
    <p className="rounded-[var(--radius)] border border-border bg-muted/50 p-3 text-sm" style={{ marginBottom: "1rem" }}>
      <Link href="/system">→ Zum System-Hub</Link>
    </p>
  );
}
