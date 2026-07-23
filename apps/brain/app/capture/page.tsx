import { createLifeAdminService, prisma } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";
import { createCaptureAction, deleteCaptureAction, updateCaptureAction } from "../brain-actions";

export const dynamic = "force-dynamic";

const CAPTURE_TYPES: Array<{ value: string; label: string }> = [
  { value: "quick_note", label: "Notiz" },
  { value: "uwe_todo", label: "UWE-Todo" },
  { value: "project_idea", label: "Projektidee" },
  { value: "dnd_idea", label: "D&D-Idee" },
  { value: "hardware", label: "Hardware" },
  { value: "contract_expense", label: "Vertrag/Ausgabe" },
  { value: "art_miniature_terrain", label: "Miniatur/Terrain" },
  { value: "link", label: "Link" },
];

const CAPTURE_STATUS: Array<{ value: string; label: string }> = [
  { value: "inbox", label: "Inbox" },
  { value: "triaged", label: "Sortiert" },
  { value: "linked", label: "Verknüpft" },
  { value: "archived", label: "Archiviert" },
];

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
      <BrainShell active="/capture" title="Capture">
        <BrainDenied />
      </BrainShell>
    );
  }

  const service = createLifeAdminService(brainPrisma, prisma);
  const captures = await service.listCaptures();

  return (
    <BrainShell
      active="/capture"
      title="Capture-Inbox"
      lede="Schnell erfassen, später einsortieren — persönliche Notizen, Ideen und Todos, lokal auf deiner Hardware."
    >
      <section className="brain-section">
        <h2>Neu erfassen</h2>
        <form action={createCaptureAction} className="brain-form brain-card">
          <label>
            Titel
            <input name="title" placeholder="Worum geht's?" required />
          </label>
          <label>
            Typ
            <select name="captureType" defaultValue="quick_note">
              {CAPTURE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Inhalt
            <textarea name="content" rows={3} placeholder="Details, Link, Kontext …" />
          </label>
          <div>
            <button type="submit" className="brain-btn">
              Erfassen
            </button>
          </div>
        </form>
      </section>

      <section className="brain-section">
        <h2>Inbox · {captures.length}</h2>
        {captures.length === 0 ? (
          <p className="brain-muted">Noch nichts erfasst.</p>
        ) : (
          <ul className="brain-list">
            {captures.map((capture) => (
              <li key={capture.id} className="brain-row">
                <div className="brain-row-head">
                  <strong>{capture.title || "(ohne Titel)"}</strong>
                  <span className="brain-tag">{capture.captureType}</span>
                  <span className="brain-muted">
                    {capture.status} · {formatDate(capture.capturedAt)}
                  </span>
                  <form action={deleteCaptureAction} style={{ marginLeft: "auto" }}>
                    <input type="hidden" name="id" value={capture.id} />
                    <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
                      Löschen
                    </button>
                  </form>
                </div>
                {capture.content ? (
                  <p style={{ margin: "0.35rem 0 0" }}>{snippet(capture.content)}</p>
                ) : null}
                <details className="brain-edit">
                  <summary>Bearbeiten</summary>
                  <form action={updateCaptureAction} className="brain-form">
                    <input type="hidden" name="id" value={capture.id} />
                    <label>
                      Titel
                      <input name="title" defaultValue={capture.title} />
                    </label>
                    <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1fr 1fr" }}>
                      <label>
                        Typ
                        <select name="captureType" defaultValue={capture.captureType}>
                          {CAPTURE_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Status
                        <select name="status" defaultValue={capture.status}>
                          {CAPTURE_STATUS.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label>
                      Inhalt
                      <textarea name="content" rows={3} defaultValue={capture.content} />
                    </label>
                    <div>
                      <button type="submit" className="brain-btn brain-btn-sm">
                        Speichern
                      </button>
                    </div>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </BrainShell>
  );
}
