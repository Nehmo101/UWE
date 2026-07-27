import Link from "next/link";
import {
  createLifeAdminService,
  parseCaptureAiProposal,
  CAPTURE_STATUS_LABELS,
  CAPTURE_TYPE_LABELS,
  PROJECT_CATEGORY_LABELS,
  prisma,
  type CaptureAiProposal,
  type CaptureStatus,
  type CaptureType,
} from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";
import {
  bulkArchiveCapturesAction,
  createCaptureAction,
  deleteCaptureAction,
  generateCaptureProposalAction,
  triageCaptureAction,
  updateCaptureAction,
  updateCaptureStatusAction,
} from "../capture-actions";

/**
 * Capture-Inbox — schnell erfassen, dann einsortieren.
 *
 * Die Seite gab es doppelt (Abschnitt H3); Brain gewinnt und hat die
 * Sortier-Funktionen der Studio-Fassung mitbekommen: Filter, KI-Vorschlag und
 * die Triage-Ziele. Was hier nicht mitkommt, ist der Bild-Upload in eine Welt —
 * das ist DM-Arbeit und bleibt in Studio.
 */

export const dynamic = "force-dynamic";

const CAPTURE_TYPES = Object.entries(CAPTURE_TYPE_LABELS) as Array<[CaptureType, string]>;
const CAPTURE_STATES = Object.entries(CAPTURE_STATUS_LABELS) as Array<[CaptureStatus, string]>;

const FILTER_TABS = [
  { key: "inbox", label: "Inbox", href: "/capture" },
  { key: "archived", label: "Archiv", href: "/capture?status=archived" },
  { key: "all", label: "Alle", href: "/capture?status=all" },
] as const;

/** Triage-Ziele, die in Brain eine Fläche haben. */
const TRIAGE_TARGETS = [
  { action: "to_personal_project", label: "→ Projekt" },
  { action: "to_workshop_project", label: "→ Werkstatt" },
  { action: "to_hardware_device", label: "→ Hardware" },
  { action: "to_contract", label: "→ Vertrag" },
  { action: "to_life_brain", label: "→ Wissen" },
] as const;

const PROPOSAL_TARGET_LABELS: Record<string, string> = {
  personal_project: "Projekt",
  workshop_project: "Werkstatt",
  dnd_page: "D&D-Seite (Studio)",
  hardware_device: "Hardware",
  contract_expense: "Vertrag / Ausgabe",
  life_brain: "Wissen",
  inbox: "bleibt in der Inbox",
};

interface Props {
  searchParams: Promise<{ status?: string }>;
}

function snippet(text: string, max = 200): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

function formatDate(value: Date): string {
  return value.toLocaleDateString("de-DE", { month: "short", day: "numeric" });
}

function ProposalLine({ proposal }: { proposal: CaptureAiProposal }) {
  return (
    <p className="brain-muted">
      Vorschlag: <strong>{PROPOSAL_TARGET_LABELS[proposal.suggestedTarget] ?? proposal.suggestedTarget}</strong>
      {" · "}
      {proposal.suggestedNextAction}
      {proposal.suggestedTags.length > 0 ? ` · ${proposal.suggestedTags.join(", ")}` : ""}
      {` · Sicherheit ${proposal.confidence}`}
    </p>
  );
}

export default async function BrainCapturePage({ searchParams }: Props) {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/capture" title="Capture">
        <BrainDenied />
      </BrainShell>
    );
  }

  const { status } = await searchParams;
  const activeTab = status === "archived" ? "archived" : status === "all" ? "all" : "inbox";
  const statusFilter = activeTab === "all" ? undefined : (activeTab as "inbox" | "archived");

  const service = createLifeAdminService(brainPrisma, prisma);
  const [captures, devices] = await Promise.all([
    service.listCaptures({ status: statusFilter, limit: 100 }),
    service.listHardwareDevices({ limit: 100 }),
  ]);

  return (
    <BrainShell
      active="/capture"
      title="Capture-Inbox"
      lede="Erst erfassen, dann einsortieren — Notizen, Ideen, Links und Todos, lokal auf deiner Hardware."
    >
      <section className="brain-section">
        <h2>Neu erfassen</h2>
        <form action={createCaptureAction} className="brain-form brain-card">
          <div className="brain-form-row">
            <label>
              Titel
              <input name="title" placeholder="Worum geht's?" />
            </label>
            <label>
              Typ
              <select name="captureType" defaultValue="quick_note">
                {CAPTURE_TYPES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Link (optional)
              <input name="url" type="url" placeholder="https://…" />
            </label>
          </div>
          <label>
            Inhalt
            <textarea name="content" rows={3} placeholder="Details, Kontext …" />
          </label>
          <div>
            <button type="submit" className="brain-btn">
              Erfassen
            </button>
          </div>
        </form>
      </section>

      <section className="brain-section">
        <h2>
          {activeTab === "archived" ? "Archiv" : activeTab === "all" ? "Alle" : "Inbox"} ·{" "}
          {captures.length}
        </h2>

        <nav className="brain-form-row" aria-label="Inbox-Filter">
          {FILTER_TABS.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={activeTab === tab.key ? "page" : undefined}
              className={
                activeTab === tab.key
                  ? "brain-btn brain-btn-sm"
                  : "brain-btn brain-btn-ghost brain-btn-sm"
              }
            >
              {tab.label}
            </Link>
          ))}
          {activeTab === "inbox" && captures.length > 0 ? (
            <form action={bulkArchiveCapturesAction}>
              <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
                Alles archivieren
              </button>
            </form>
          ) : null}
        </nav>

        {captures.length === 0 ? (
          <p className="brain-muted">Nichts hier.</p>
        ) : (
          <ul className="brain-list">
            {captures.map((capture) => {
              const proposal = parseCaptureAiProposal(capture);
              return (
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

                  {capture.content ? <p>{snippet(capture.content)}</p> : null}
                  {capture.url ? (
                    <p className="brain-muted" style={{ wordBreak: "break-all" }}>
                      <a href={capture.url} target="_blank" rel="noreferrer">
                        {capture.url}
                      </a>
                    </p>
                  ) : null}

                  {proposal ? (
                    <ProposalLine proposal={proposal} />
                  ) : (
                    <form action={generateCaptureProposalAction}>
                      <input type="hidden" name="id" value={capture.id} />
                      <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
                        Vorschlag erzeugen
                      </button>
                    </form>
                  )}

                  <details className="brain-edit">
                    <summary>Einsortieren</summary>
                    <div className="brain-form-row">
                      {TRIAGE_TARGETS.map((target) => (
                        <form key={target.action} action={triageCaptureAction}>
                          <input type="hidden" name="id" value={capture.id} />
                          <input type="hidden" name="action" value={target.action} />
                          {target.action === "to_hardware_device" && devices.length > 0 ? (
                            <label>
                              Gerät
                              <select name="hardwareDeviceId" defaultValue="">
                                <option value="">Neues Gerät</option>
                                {devices.map((device) => (
                                  <option key={device.id} value={device.id}>
                                    {device.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : null}
                          {target.action === "to_life_brain" ? (
                            <label className="brain-muted">
                              <input type="checkbox" name="lifeBrainAsDocument" /> als Dokument
                            </label>
                          ) : null}
                          <button type="submit" className="brain-btn brain-btn-sm">
                            {target.label}
                          </button>
                        </form>
                      ))}
                      <form action={updateCaptureStatusAction}>
                        <input type="hidden" name="id" value={capture.id} />
                        <input type="hidden" name="status" value="archived" />
                        <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
                          Archivieren
                        </button>
                      </form>
                    </div>
                    <p className="brain-muted">
                      Kategorien: {Object.values(PROJECT_CATEGORY_LABELS).join(" · ")}
                    </p>
                  </details>

                  <details className="brain-edit">
                    <summary>Bearbeiten</summary>
                    <form action={updateCaptureAction} className="brain-form">
                      <input type="hidden" name="id" value={capture.id} />
                      <label>
                        Titel
                        <input name="title" defaultValue={capture.title} />
                      </label>
                      <div className="brain-form-row">
                        <label>
                          Typ
                          <select name="captureType" defaultValue={capture.captureType}>
                            {CAPTURE_TYPES.map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Status
                          <select name="status" defaultValue={capture.status}>
                            {CAPTURE_STATES.map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
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
              );
            })}
          </ul>
        )}
      </section>
    </BrainShell>
  );
}
