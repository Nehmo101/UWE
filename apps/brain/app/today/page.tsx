import { createLifeAdminService, prisma } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { getBrainOwner } from "@/src/lib/page-owner";
import { dayIndex } from "@uwe/shared-ui";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";

export const dynamic = "force-dynamic";

function formatDate(value: Date): string {
  return value.toLocaleDateString("de-DE", { month: "short", day: "numeric" });
}

export default async function BrainTodayPage() {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/today" title="Heute">
        <BrainDenied />
      </BrainShell>
    );
  }

  const service = createLifeAdminService(brainPrisma, prisma);
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
    <BrainShell
      active="/today"
      title="Heute"
      eyebrow="Owner-Bereich · privat"
      lede="Dein Daily Admin OS — lokal, auch um Mitternacht. Cloud-KI erhält keinen Zugriff."
      sceneIndex={dayIndex()}
    >
      <div className="brain-kpis">
        {kpis.map((k) => (
          <div className="brain-kpi" key={k.label}>
            <strong>{k.n}</strong>
            <span>{k.label}</span>
          </div>
        ))}
      </div>

      <section className="brain-section">
        <h2>Zuletzt erfasst</h2>
        {summary.recentCaptures.length === 0 ? (
          <p className="brain-muted">Nichts in der Capture-Inbox.</p>
        ) : (
          <ul className="brain-list">
            {summary.recentCaptures.map((capture) => (
              <li key={capture.id} className="brain-row">
                <div className="brain-row-head">
                  <strong>{capture.title}</strong>
                  <span className="brain-tag">{capture.captureType}</span>
                  <span className="brain-muted">
                    {capture.status} · {formatDate(capture.capturedAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </BrainShell>
  );
}
