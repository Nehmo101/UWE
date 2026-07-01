import { CollapsibleSection } from "@uwe/shared-ui";
import {
  createFactionStateService,
  createPrismaClient,
} from "@uwe/database/server";
import { upsertFactionStateAction } from "@/app/worlds/[worldSlug]/faction-state-actions";

interface Props {
  worldSlug: string;
  pageId: string;
  pageSlug: string;
  category: string;
}

function formatJsonField(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return JSON.stringify(value, null, 2);
}

export async function FactionStateEditPanel({ worldSlug, pageId, pageSlug, category }: Props) {
  const db = createPrismaClient();
  const factions = createFactionStateService(db);
  const state = await factions.getByPageId(pageId);
  await db.$disconnect();

  return (
    <CollapsibleSection title="Fraktions-State" defaultOpen={Boolean(state)}>
      <p className="uwe-hint">
        Strukturierter Zustand für Simulation und Kampagnen-Tracking — ergänzt die Wiki-Blöcke.
      </p>

      <form action={upsertFactionStateAction} className="uwe-v2-form">
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="pageId" value={pageId} />
        <input type="hidden" name="pageSlug" value={pageSlug} />
        <input type="hidden" name="category" value={category} />

        <label>
          Agenda
          <textarea
            name="agenda"
            rows={3}
            defaultValue={state?.agenda ?? ""}
            placeholder="Aktuelle Schwerpunkte der Fraktion"
          />
        </label>

        <label>
          Machtstufe (0–10, optional)
          <input
            name="powerLevel"
            type="number"
            min={0}
            max={10}
            defaultValue={state?.powerLevel ?? ""}
          />
        </label>

        <label>
          Ziele (JSON, optional)
          <textarea
            name="goalsJson"
            rows={4}
            defaultValue={formatJsonField(state?.goals)}
            placeholder='[{"title":"Handelsmonopol","priority":"high"}]'
          />
        </label>

        <label>
          Ressourcen (JSON, optional)
          <textarea
            name="resourcesJson"
            rows={4}
            defaultValue={formatJsonField(state?.resources)}
            placeholder='{"gold":1200,"influence":3}'
          />
        </label>

        <label>
          Beziehungen (JSON, optional)
          <textarea
            name="relationshipsJson"
            rows={4}
            defaultValue={formatJsonField(state?.relationships)}
            placeholder='{"allies":["gilde-der-magier"],"rivals":["schattengarde"]}'
          />
        </label>

        <label>
          Notizen
          <textarea name="notes" rows={3} defaultValue={state?.notes ?? ""} />
        </label>

        <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
          Fraktions-State speichern
        </button>
      </form>
    </CollapsibleSection>
  );
}
