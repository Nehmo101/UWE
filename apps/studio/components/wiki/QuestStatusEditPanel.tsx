import { CollapsibleSection, QuestStatusBadge } from "@uwe/shared-ui";
import { getAppRepository, QUEST_LIFECYCLE_LABELS } from "@uwe/database/server";
import { updateQuestStatusAction } from "@/app/worlds/[worldSlug]/quest-status-actions";
import { Button, Label } from "@/src/components/ui";

/** TODO(design-kit): natives Select bleibt — Server-Action-Formular (FormData)
    braucht name/defaultValue ohne Client-State, siehe PageChroniclePanel.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

interface Props {
  worldSlug: string;
  pageId: string;
  pageSlug: string;
  category: string;
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Offen (Standard, kein Status gesetzt)" },
  ...Object.entries(QUEST_LIFECYCLE_LABELS).map(([value, label]) => ({ value, label })),
];

export async function QuestStatusEditPanel({ worldSlug, pageId, pageSlug, category }: Props) {
  const repo = getAppRepository();
  const page = await repo.getPageById(pageId);
  const currentStatus = page?.questStatus ?? null;

  return (
    <CollapsibleSection title="Quest-Status" defaultOpen>
      <p className="text-sm text-muted-foreground">
        Steuert, ob die Quest im Portal-Questlog als offen, erledigt oder gescheitert erscheint.
        Unbekannter Status zählt als offen. Statuswechsel sind jederzeit in beide Richtungen
        möglich (z.&nbsp;B. gescheiterte Quest wieder öffnen).
      </p>

      <p className="text-sm text-muted-foreground">
        Aktueller Status: <QuestStatusBadge status={currentStatus} />
      </p>

      <form action={updateQuestStatusAction} className="flex flex-col gap-4">
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="pageId" value={pageId} />
        <input type="hidden" name="pageSlug" value={pageSlug} />
        <input type="hidden" name="category" value={category} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quest-status-select">Status</Label>
          <select
            id="quest-status-select"
            name="questStatus"
            defaultValue={currentStatus ?? ""}
            className={NATIVE_SELECT_CLASS}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || "open-default"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" className="self-start">
          Quest-Status speichern
        </Button>
      </form>
    </CollapsibleSection>
  );
}
