import Link from "next/link";
import {
  CAPTURE_STATUS_LABELS,
  CAPTURE_TYPE_LABELS,
} from "@uwe/database/capture-constants";
import {
  CAPTURE_TRIAGE_ACTION_LABELS,
  parseCaptureAiProposal,
  PROJECT_CATEGORY_LABELS,
  WORKSHOP_TYPE_LABELS,
  type CaptureEntry,
  type CaptureTriageAction,
  type HardwareDevice,
  type PersonalProjectCategory,
  type WorkshopProjectType,
} from "@uwe/database/capture-triage-ui";
import {
  generateCaptureProposalAction,
  reviewCaptureProposalAction,
  triageCaptureAction,
} from "@/app/capture-actions";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

const PROPOSAL_TARGET_LABELS: Record<string, string> = {
  personal_project: "Projekt",
  workshop_project: "Werkstatt",
  dnd_page: "DnD-Seite",
  hardware_device: "Hardware",
  contract_expense: "Vertrag",
  life_brain: "Life Brain",
  inbox: "Inbox",
};

interface WorldOption {
  id: string;
  slug: string;
  name: string;
}

interface Props {
  capture: CaptureEntry;
  worlds: WorldOption[];
  hardwareDevices: HardwareDevice[];
}

const BASE_TRIAGE_ACTIONS: CaptureTriageAction[] = [
  "to_personal_project",
  "to_workshop_project",
  "to_dnd_page",
  "to_hardware_device",
  "to_contract",
  "to_life_brain",
  "archive",
  "delete",
];

function triageActionsForCapture(capture: CaptureEntry): CaptureTriageAction[] {
  if (capture.captureType === "file_image") {
    return ["to_image_studio", ...BASE_TRIAGE_ACTIONS];
  }
  return BASE_TRIAGE_ACTIONS;
}

function readIntent(capture: CaptureEntry): string | null {
  if (!capture.metadata || typeof capture.metadata !== "object" || Array.isArray(capture.metadata)) {
    return null;
  }
  const intent = (capture.metadata as Record<string, unknown>).captureIntent;
  return typeof intent === "string" ? intent : null;
}

export function CaptureTriagePanel({ capture, worlds, hardwareDevices }: Props) {
  const proposal = parseCaptureAiProposal(capture);
  const triageActions = triageActionsForCapture(capture);
  const intent = readIntent(capture);
  const typeLabel =
    intent === "life_brain"
      ? "Life-Brain-Fakt"
      : CAPTURE_TYPE_LABELS[capture.captureType];

  return (
    <div className="uwe-capture-triage">
      <header className="uwe-capture-triage-header">
        <p className="uwe-capture-triage-meta">
          {typeLabel} · {CAPTURE_STATUS_LABELS[capture.status]} ·{" "}
          {DATE_FORMAT.format(capture.capturedAt)}
        </p>
        <h2>{capture.title}</h2>
        {capture.content ? <p className="uwe-capture-triage-content">{capture.content}</p> : null}
        {capture.url ? (
          <p>
            <a href={capture.url} target="_blank" rel="noreferrer">
              {capture.url}
            </a>
          </p>
        ) : null}
        {capture.storageKey ? (
          <p>
            {capture.captureType === "voice_memo" ? (
              <audio controls src={`/api/capture/files/${capture.id}`} className="uwe-capture-audio">
                <a href={`/api/capture/files/${capture.id}`} target="_blank" rel="noreferrer">
                  Sprachmemo abspielen
                </a>
              </audio>
            ) : (
              <a href={`/api/capture/files/${capture.id}`} target="_blank" rel="noreferrer">
                Anhang öffnen
              </a>
            )}
          </p>
        ) : null}
      </header>

      <section className="uwe-v2-card uwe-v2-section">
        <div className="uwe-capture-proposal-head">
          <h3 className="uwe-v2-section-title">KI-Vorschlag (Review)</h3>
          {proposal ? (
            <span className="uwe-badge uwe-badge-muted">
              {proposal.source === "rtx" ? "RTX" : "Heuristik"}
            </span>
          ) : null}
          {!proposal ? (
            <form action={generateCaptureProposalAction}>
              <input type="hidden" name="id" value={capture.id} />
              <input type="hidden" name="returnTo" value={`/capture/${capture.id}`} />
              <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
                Vorschlag erzeugen
              </button>
            </form>
          ) : null}
        </div>

        {proposal ? (
          <div className="uwe-capture-proposal" data-status={proposal.status}>
            <dl className="uwe-capture-proposal-grid">
              <div>
                <dt>Kategorie</dt>
                <dd>{proposal.suggestedCategory}</dd>
              </div>
              <div>
                <dt>Zielbereich</dt>
                <dd>{PROPOSAL_TARGET_LABELS[proposal.suggestedTarget] ?? proposal.suggestedTarget}</dd>
              </div>
              <div>
                <dt>Next Action</dt>
                <dd>{proposal.suggestedNextAction}</dd>
              </div>
              <div>
                <dt>Tags</dt>
                <dd>
                  {proposal.suggestedTags.length > 0
                    ? proposal.suggestedTags.map((tag) => (
                        <span key={tag} className="uwe-capture-tag">
                          {tag}
                        </span>
                      ))
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Confidence</dt>
                <dd>{proposal.confidence}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{proposal.status}</dd>
              </div>
            </dl>
            {proposal.status === "draft" ? (
              <div className="uwe-inline-actions">
                <form action={reviewCaptureProposalAction}>
                  <input type="hidden" name="id" value={capture.id} />
                  <input type="hidden" name="status" value="accepted" />
                  <input type="hidden" name="returnTo" value={`/capture/${capture.id}`} />
                  <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary uwe-v2-btn-sm">
                    Vorschlag annehmen
                  </button>
                </form>
                <form action={reviewCaptureProposalAction}>
                  <input type="hidden" name="id" value={capture.id} />
                  <input type="hidden" name="status" value="rejected" />
                  <input type="hidden" name="returnTo" value={`/capture/${capture.id}`} />
                  <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
                    Ablehnen
                  </button>
                </form>
              </div>
            ) : (
              <p className="uwe-dashboard-muted">
                Vorschlag wurde reviewt — Übernahme erfolgt nur über Triage-Aktionen unten.
              </p>
            )}
          </div>
        ) : (
          <p className="uwe-dashboard-muted">
            Heuristischer Vorschlag ohne RTX — keine automatische Übernahme.
          </p>
        )}
      </section>

      <section className="uwe-v2-card uwe-v2-section">
        <h3 className="uwe-v2-section-title">Triage</h3>
        <p className="uwe-dashboard-muted">
          Wähle eine Zielaktion. Captures werden verknüpft, nicht stillschweigend überschrieben.
        </p>

        <div className="uwe-capture-triage-actions">
          {triageActions.map((action) => (
            <details key={action} className="uwe-capture-triage-action">
              <summary>{CAPTURE_TRIAGE_ACTION_LABELS[action]}</summary>
              <form action={triageCaptureAction} className="uwe-capture-triage-form">
                <input type="hidden" name="id" value={capture.id} />
                <input type="hidden" name="action" value={action} />
                <input type="hidden" name="returnTo" value="/capture" />

                {action === "to_personal_project" ? (
                  <label>
                    Kategorie
                    <select name="projectCategory" defaultValue="other">
                      {(Object.keys(PROJECT_CATEGORY_LABELS) as PersonalProjectCategory[]).map(
                        (category) => (
                          <option key={category} value={category}>
                            {PROJECT_CATEGORY_LABELS[category]}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                ) : null}

                {action === "to_workshop_project" ? (
                  <label>
                    Werkstatt-Typ
                    <select name="workshopProjectType" defaultValue="other">
                      {(Object.keys(WORKSHOP_TYPE_LABELS) as WorkshopProjectType[]).map((type) => (
                        <option key={type} value={type}>
                          {WORKSHOP_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {action === "to_dnd_page" ? (
                  <label>
                    Welt
                    <select name="worldId" defaultValue="">
                      <option value="">— später verknüpfen —</option>
                      {worlds.map((world) => (
                        <option key={world.id} value={world.id}>
                          {world.name} ({world.slug})
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {action === "to_hardware_device" ? (
                  <label>
                    Gerät (optional — leer = neues Gerät)
                    <select name="hardwareDeviceId" defaultValue="">
                      <option value="">Neues Gerät anlegen</option>
                      {hardwareDevices.map((device) => (
                        <option key={device.id} value={device.id}>
                          {device.name} ({device.status})
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {action === "to_life_brain" ? (
                  <label className="uwe-checkbox-label">
                    <input type="checkbox" name="lifeBrainAsDocument" />
                    Als Dokument statt Kurz-Fakt speichern
                  </label>
                ) : null}

                {action === "delete" ? (
                  <p className="uwe-capture-warning">Capture wird dauerhaft gelöscht.</p>
                ) : null}

                <button
                  type="submit"
                  className={`uwe-v2-btn uwe-v2-btn-sm ${action === "delete" ? "uwe-v2-btn-danger" : "uwe-v2-btn-primary"}`}
                >
                  {CAPTURE_TRIAGE_ACTION_LABELS[action]}
                </button>
              </form>
            </details>
          ))}
        </div>
      </section>

      <p className="uwe-dashboard-muted">
        <Link href="/capture">← Zurück zur Inbox</Link>
      </p>
    </div>
  );
}
