import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";

export default function PortalNotFound() {
  return (
    <div className="page">
      <EmptyState
        title="Seite nicht gefunden"
        description="Diesen Inhalt gibt es nicht — oder er ist für dich (noch) nicht freigeschaltet."
        action={
          <Link className="uwe-btn uwe-btn-primary" href="/">
            Zur Portal-Startseite
          </Link>
        }
      />
    </div>
  );
}
