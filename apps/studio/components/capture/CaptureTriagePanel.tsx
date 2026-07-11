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
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";

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

/** Native select styling — Server-Action-Formulare (FormData) brauchen name/defaultValue
 * ohne Client-State; Kit-Select (Radix) unterstützt das nicht. TODO(design-kit): siehe
 * Verwendungen unten (Kategorie/Werkstatt-Typ/Welt/Gerät). */
const SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const CHECKBOX_ROW_CLASS = "flex items-center gap-2 text-sm";
const CHECKBOX_CLASS = "size-4 rounded border-input";

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
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <p className="text-sm text-muted-foreground">
          {typeLabel} · {CAPTURE_STATUS_LABELS[capture.status]} ·{" "}
          {DATE_FORMAT.format(capture.capturedAt)}
        </p>
        <h2 className="text-lg font-semibold text-foreground">{capture.title}</h2>
        {capture.content ? <p className="whitespace-pre-wrap text-sm">{capture.content}</p> : null}
        {capture.url ? (
          <p>
            <a
              href={capture.url}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              {capture.url}
            </a>
          </p>
        ) : null}
        {capture.storageKey ? (
          <p>
            {capture.captureType === "voice_memo" ? (
              <audio controls src={`/api/capture/files/${capture.id}`} className="w-full max-w-md">
                <a href={`/api/capture/files/${capture.id}`} target="_blank" rel="noreferrer">
                  Sprachmemo abspielen
                </a>
              </audio>
            ) : (
              <a
                href={`/api/capture/files/${capture.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                Anhang öffnen
              </a>
            )}
          </p>
        ) : null}
      </header>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>KI-Vorschlag (Review)</CardTitle>
          <div className="flex items-center gap-2">
            {proposal ? <Badge>{proposal.source === "rtx" ? "RTX" : "Heuristik"}</Badge> : null}
            {!proposal ? (
              <form action={generateCaptureProposalAction}>
                <input type="hidden" name="id" value={capture.id} />
                <input type="hidden" name="returnTo" value={`/capture/${capture.id}`} />
                <Button type="submit" variant="secondary" size="sm">
                  Vorschlag erzeugen
                </Button>
              </form>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {proposal ? (
            <div data-status={proposal.status} className="flex flex-col gap-4">
              <dl className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-x-4 gap-y-2.5">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Kategorie</dt>
                  <dd className="mt-0.5 text-sm">{proposal.suggestedCategory}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Zielbereich</dt>
                  <dd className="mt-0.5 text-sm">
                    {PROPOSAL_TARGET_LABELS[proposal.suggestedTarget] ?? proposal.suggestedTarget}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Next Action</dt>
                  <dd className="mt-0.5 text-sm">{proposal.suggestedNextAction}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Tags</dt>
                  <dd className="mt-0.5 text-sm">
                    {proposal.suggestedTags.length > 0
                      ? proposal.suggestedTags.map((tag) => (
                          <span
                            key={tag}
                            className="mr-1 mt-0.5 inline-block rounded-full border border-border bg-muted px-2 py-0.5 text-xs"
                          >
                            {tag}
                          </span>
                        ))
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Confidence</dt>
                  <dd className="mt-0.5 text-sm">{proposal.confidence}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Status</dt>
                  <dd className="mt-0.5 text-sm">{proposal.status}</dd>
                </div>
              </dl>
              {proposal.status === "draft" ? (
                <div className="flex flex-wrap gap-2">
                  <form action={reviewCaptureProposalAction}>
                    <input type="hidden" name="id" value={capture.id} />
                    <input type="hidden" name="status" value="accepted" />
                    <input type="hidden" name="returnTo" value={`/capture/${capture.id}`} />
                    <Button type="submit" size="sm">
                      Vorschlag annehmen
                    </Button>
                  </form>
                  <form action={reviewCaptureProposalAction}>
                    <input type="hidden" name="id" value={capture.id} />
                    <input type="hidden" name="status" value="rejected" />
                    <input type="hidden" name="returnTo" value={`/capture/${capture.id}`} />
                    <Button type="submit" variant="secondary" size="sm">
                      Ablehnen
                    </Button>
                  </form>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Vorschlag wurde reviewt — Übernahme erfolgt nur über Triage-Aktionen unten.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Heuristischer Vorschlag ohne RTX — keine automatische Übernahme.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Triage</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Wähle eine Zielaktion. Captures werden verknüpft, nicht stillschweigend überschrieben.
          </p>

          <div className="flex flex-col gap-2">
            {triageActions.map((action) => (
              <details
                key={action}
                className="rounded-[var(--radius)] border border-border bg-card px-3 py-2"
              >
                <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
                  {CAPTURE_TRIAGE_ACTION_LABELS[action]}
                </summary>
                <form action={triageCaptureAction} className="flex flex-col gap-3 py-3">
                  <input type="hidden" name="id" value={capture.id} />
                  <input type="hidden" name="action" value={action} />
                  <input type="hidden" name="returnTo" value="/capture" />

                  {action === "to_personal_project" ? (
                    <label className="flex flex-col gap-1.5 text-sm">
                      Kategorie
                      <select name="projectCategory" defaultValue="other" className={SELECT_CLASS}>
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
                    <label className="flex flex-col gap-1.5 text-sm">
                      Werkstatt-Typ
                      <select name="workshopProjectType" defaultValue="other" className={SELECT_CLASS}>
                        {(Object.keys(WORKSHOP_TYPE_LABELS) as WorkshopProjectType[]).map((type) => (
                          <option key={type} value={type}>
                            {WORKSHOP_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {action === "to_dnd_page" ? (
                    <label className="flex flex-col gap-1.5 text-sm">
                      Welt
                      <select name="worldId" defaultValue="" className={SELECT_CLASS}>
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
                    <label className="flex flex-col gap-1.5 text-sm">
                      Gerät (optional — leer = neues Gerät)
                      <select name="hardwareDeviceId" defaultValue="" className={SELECT_CLASS}>
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
                    // TODO(design-kit): kein Checkbox-Kit-Component vorhanden — natives
                    // input[type=checkbox] + Tailwind verwendet.
                    <label className={CHECKBOX_ROW_CLASS}>
                      <input type="checkbox" name="lifeBrainAsDocument" className={CHECKBOX_CLASS} />
                      Als Dokument statt Kurz-Fakt speichern
                    </label>
                  ) : null}

                  {action === "delete" ? (
                    <p className="text-sm text-destructive">Capture wird dauerhaft gelöscht.</p>
                  ) : null}

                  <Button
                    type="submit"
                    size="sm"
                    variant={action === "delete" ? "destructive" : "default"}
                    className="self-start"
                  >
                    {CAPTURE_TRIAGE_ACTION_LABELS[action]}
                  </Button>
                </form>
              </details>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        <Link href="/capture">← Zurück zur Inbox</Link>
      </p>
    </div>
  );
}
