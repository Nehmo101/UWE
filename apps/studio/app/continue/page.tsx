import Link from "next/link";
import { prisma } from "@uwe/database/server";
import {
  createContinueWorkService,
  continuationKindLabel,
  type ContinuationKind,
} from "@uwe/database/continue-work";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { requireStudioAccess } from "@/src/lib/auth";

export const dynamic = "force-dynamic";

const KIND_ICON: Record<ContinuationKind, string> = {
  project: "🧩",
  workshop: "🔧",
  capture: "📥",
  scan: "📄",
};

export default async function ContinuePage() {
  await requireStudioAccess();
  const continuations = await createContinueWorkService(prisma).getContinuations(5);

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Mach weiter" }]} />}>
      <PageHeader
        title="Mach weiter, wo du aufgehört hast"
        summary="Deine wahrscheinlich relevanten Fortsetzungen: offene Projekte mit nächstem Schritt, Werkstatt-Aufgaben, unbearbeitete Captures und wartende Scans."
      />

      <section className="uwe-v2-section">
        {continuations.length === 0 ? (
          <p className="uwe-dashboard-muted">
            Nichts Offenes gefunden — alles erledigt oder noch nichts angefangen.
          </p>
        ) : (
          <ul className="uwe-today-card-list">
            {continuations.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="uwe-today-card">
                <h3>
                  <Link href={item.href}>
                    {KIND_ICON[item.kind]} {item.title}
                  </Link>
                </h3>
                <p className="uwe-dashboard-muted">
                  <span className="uwe-badge">{continuationKindLabel(item.kind)}</span> {item.hint}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="uwe-dashboard-muted">
        Mehr Kontext im{" "}
        <Link href="/today">Heute-Dashboard</Link> oder in der{" "}
        <Link href="/capture">Capture-Inbox</Link>.
      </p>
    </StudioShell>
  );
}
