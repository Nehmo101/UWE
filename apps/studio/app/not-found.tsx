import Link from "next/link";
import { STUDIO_SESSION_ENTRY_PATH } from "@uwe/auth";
import { EmptyState } from "@uwe/shared-ui";

export default function StudioNotFound() {
  return (
    <div className="page">
      <EmptyState
        title="Seite nicht gefunden"
        description="Diese Welt oder Seite existiert nicht (mehr). Prüfe die Adresse oder kehre zum Dashboard zurück."
        action={
          <Link className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] px-4 py-2 text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90" href={STUDIO_SESSION_ENTRY_PATH}>
            Zum Dashboard
          </Link>
        }
      />
    </div>
  );
}
