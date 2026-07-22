import Link from "next/link";
import { brainPrisma } from "@uwe/database/brain-client";
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
  const continuations = await createContinueWorkService(brainPrisma).getContinuations(5);

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Mach weiter" }]} />}>
      <PageHeader
        title="Mach weiter, wo du aufgehört hast"
        summary="Deine wahrscheinlich relevanten Fortsetzungen: offene Projekte mit nächstem Schritt, Werkstatt-Aufgaben, unbearbeitete Captures und wartende Scans."
      />

      <section className="flex flex-col gap-3">
        {continuations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nichts Offenes gefunden — alles erledigt oder noch nichts angefangen.
          </p>
        ) : (
          <ul className="grid gap-2">
            {continuations.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm">
                <h3>
                  <Link href={item.href}>
                    {KIND_ICON[item.kind]} {item.title}
                  </Link>
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-[var(--radius)] border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{continuationKindLabel(item.kind)}</span> {item.hint}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm text-muted-foreground">
        Mehr Kontext im{" "}
        <Link href="/today">Heute-Dashboard</Link> oder in der{" "}
        <Link href="/capture">Capture-Inbox</Link>.
      </p>
    </StudioShell>
  );
}
