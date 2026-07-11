import { CollapsibleSection } from "@uwe/shared-ui";
import {
  createFactionStateService,
  createPrismaClient,
} from "@uwe/database/server";
import { upsertFactionStateAction } from "@/app/worlds/[worldSlug]/faction-state-actions";
import { Button, Input, Label, Textarea } from "@/src/components/ui";

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
      <p className="text-sm text-muted-foreground">
        Strukturierter Zustand für Simulation und Kampagnen-Tracking — ergänzt die Wiki-Blöcke.
        Nutze den Fraktions-Simulator darunter (RTX-only, Review vor Übernahme in die Chronik).
      </p>

      <form action={upsertFactionStateAction} className="flex flex-col gap-4">
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="pageId" value={pageId} />
        <input type="hidden" name="pageSlug" value={pageSlug} />
        <input type="hidden" name="category" value={category} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="faction-state-agenda">Agenda</Label>
          <Textarea
            id="faction-state-agenda"
            name="agenda"
            rows={3}
            defaultValue={state?.agenda ?? ""}
            placeholder="Aktuelle Schwerpunkte der Fraktion"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="faction-state-power-level">Machtstufe (0–10, optional)</Label>
          <Input
            id="faction-state-power-level"
            name="powerLevel"
            type="number"
            min={0}
            max={10}
            defaultValue={state?.powerLevel ?? ""}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="faction-state-goals">Ziele (JSON, optional)</Label>
          <Textarea
            id="faction-state-goals"
            name="goalsJson"
            rows={4}
            defaultValue={formatJsonField(state?.goals)}
            placeholder='[{"title":"Handelsmonopol","priority":"high"}]'
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="faction-state-resources">Ressourcen (JSON, optional)</Label>
          <Textarea
            id="faction-state-resources"
            name="resourcesJson"
            rows={4}
            defaultValue={formatJsonField(state?.resources)}
            placeholder='{"gold":1200,"influence":3}'
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="faction-state-relationships">Beziehungen (JSON, optional)</Label>
          <Textarea
            id="faction-state-relationships"
            name="relationshipsJson"
            rows={4}
            defaultValue={formatJsonField(state?.relationships)}
            placeholder='{"allies":["gilde-der-magier"],"rivals":["schattengarde"]}'
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="faction-state-notes">Notizen</Label>
          <Textarea id="faction-state-notes" name="notes" rows={3} defaultValue={state?.notes ?? ""} />
        </div>

        <Button type="submit" className="self-start">
          Fraktions-State speichern
        </Button>
      </form>
    </CollapsibleSection>
  );
}
