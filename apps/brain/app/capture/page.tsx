import { createLifeAdminService, prisma } from "@uwe/database/server";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainNav } from "@/src/components/BrainNav";

export const dynamic = "force-dynamic";

function snippet(text: string, max = 160): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

function formatDate(value: Date): string {
  return value.toLocaleDateString("de-DE", { month: "short", day: "numeric" });
}

export default async function BrainCapturePage() {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <main className="page">
        <div className="card">
          <BrainNav active="/capture" />
          <h1>Capture</h1>
          <p>Dieser Bereich ist ausschließlich für den System-Owner.</p>
        </div>
      </main>
    );
  }

  const service = createLifeAdminService(prisma);
  const captures = await service.listCaptures();

  return (
    <main className="page">
      <div className="card" style={{ maxWidth: "56rem" }}>
        <BrainNav active="/capture" />
        <span className="eyebrow">Owner-only · lokal · nie in der Cloud</span>
        <h1>Capture-Inbox</h1>
        <p>{captures.length} Eintrag/Einträge — persönliche Erfassung, lokal auf deiner Hardware.</p>

        {captures.length === 0 ? (
          <p>Noch nichts erfasst.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: "1rem 0 0", display: "grid", gap: "0.6rem" }}>
            {captures.map((capture) => (
              <li key={capture.id} className="brain-row">
                <strong>{capture.title}</strong>
                <span className="brain-tag">{capture.captureType}</span>
                <span className="brain-muted"> · {capture.status} · {formatDate(capture.capturedAt)}</span>
                {capture.content ? <p style={{ margin: "0.35rem 0 0" }}>{snippet(capture.content)}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
