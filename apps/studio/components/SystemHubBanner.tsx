import Link from "next/link";

export function SystemHubBanner() {
  return (
    <p className="uwe-notice" style={{ marginBottom: "1rem" }}>
      <Link href="/system">→ Zum System-Hub</Link>
    </p>
  );
}
