import { createLifeAdminService, prisma } from "@uwe/database/server";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainNav } from "@/src/components/BrainNav";

export const dynamic = "force-dynamic";

function formatDate(value: Date): string {
  return value.toLocaleDateString("de-DE", { month: "short", day: "numeric" });
}

export default async function BrainTodayPage() {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <main className="page">
        <div className="card">
          <BrainNav active="/today" />
          <h1>Heute</h1>
          <p>Dieser Bereich ist ausschließlich für den System-Owner.</p>
        </div>
      </main>
    );
  }

  const service = createLifeAdminService(prisma);
  const summary = await service.getTodaySummary();

  const kpis = [
    { n: summary.inboxCaptureCount, label: "Capture-Inbox" },
    { n: summary.activeProjectCount, label: "Aktive Projekte" },
    { n: summary.activeWorkshopCount, label: "Werkstatt aktiv" },
    { n: summary.contractsNeedingReview, label: "Verträge prüfen" },
    { n: summary.hardwareIssues, label: "Hardware-Warnungen" },
    { n: summary.openSetupSteps, label: "Setup offen" },
  ];

  return (
    <main className="page">
      <div className="card" style={{ maxWidth: "56rem" }}>
        <BrainNav active="/today" />
        <span className="eyebrow">Owner-only · lokal · nie in der Cloud</span>
        <h1>Heute</h1>
        <p>Dein Daily Admin OS — Überblick, lokal auf deiner Hardware.</p>

        <div className="brain-kpis">
          {kpis.map((k) => (
            <div className="brain-kpi" key={k.label}>
              <strong>{k.n}</strong>
              <span>{k.label}</span>
            </div>
          ))}
        </div>

        <section style={{ marginTop: "1rem" }}>
          <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.5rem" }}>Zuletzt erfasst</h2>
          {summary.recentCaptures.length === 0 ? (
            <p>Nichts in der Capture-Inbox.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.6rem" }}>
              {summary.recentCaptures.map((capture) => (
                <li key={capture.id} className="brain-row">
                  <strong>{capture.title}</strong>
                  <span className="brain-tag">{capture.captureType}</span>
                  <span className="brain-muted"> · {capture.status} · {formatDate(capture.capturedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
