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
          <Link className="uwe-v2-btn uwe-v2-btn-primary" href={STUDIO_SESSION_ENTRY_PATH}>
            Zum Dashboard
          </Link>
        }
      />
    </div>
  );
}
