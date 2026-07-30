import Link from "next/link";
import { brainPrisma } from "@uwe/database/brain-client";
import {
  createContinueWorkService,
  continuationKindLabel,
  type ContinuationKind,
} from "@uwe/database/continue-work";
import { EmptyState, StatusPill } from "@uwe/shared-ui";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { buttonVariants } from "@/src/components/ui/button";
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
          // Ein grauer Satz war hier zu wenig: wer nichts Offenes hat, sieht
          // diese Seite als Erstes und braucht einen nächsten Schritt, keine
          // Feststellung.
          <EmptyState
            icon="✓"
            title="Nichts Offenes"
            description="Alles erledigt — oder noch nichts angefangen. Beides ist ein guter Zustand."
            action={
              <Link className={buttonVariants({ variant: "outline" })} href="/worlds">
                Zu den Welten
              </Link>
            }
          />
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
                  {/* Die Art der Fortsetzung stand als farbloses Kästchen da.
                      Als StatusPill trägt sie ihr Zeichen mit — dieselbe
                      Auskunft ohne Verlass auf Farbe. */}
                  <StatusPill glyph={KIND_ICON[item.kind]} tone="info">
                    {continuationKindLabel(item.kind)}
                  </StatusPill>{" "}
                  {item.hint}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm text-muted-foreground">
        Mehr Kontext im <Link href="/brain">Brain Store</Link> oder in der{" "}
        <Link href="/worlds">Weltübersicht</Link>.
      </p>
    </StudioShell>
  );
}
