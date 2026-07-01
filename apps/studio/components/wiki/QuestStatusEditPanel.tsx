import { CollapsibleSection } from "@uwe/shared-ui";
import {
  getAppRepository,
  QUEST_LIFECYCLE_LABELS,
  type QuestLifecycleStatus,
} from "@uwe/database/server";
import { updateQuestStatusAction } from "@/app/worlds/[worldSlug]/quest-status-actions";

interface Props {
  worldSlug: string;
  pageId: string;
  pageSlug: string;
  category: string;
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Offen (Standard)" },
  ...Object.entries(QUEST_LIFECYCLE_LABELS).map(([value, label]) => ({ value, label })),
];

export async function QuestStatusEditPanel({ worldSlug, pageId, pageSlug, category }: Props) {
  const repo = getAppRepository();
  const page = await repo.getPageById(pageId);
  const currentStatus = page?.questStatus ?? null;

  return (
    <CollapsibleSection title="Quest-Status" defaultOpen>
      <p className="uwe-hint">
        Steuert, ob die Quest im Portal-Questlog als offen, erledigt oder gescheitert erscheint.
        Unbekannter Status zählt als offen.
      </p>

      <form action={updateQuestStatusAction} className="uwe-v2-form">
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="pageId" value={pageId} />
        <input type="hidden" name="pageSlug" value={pageSlug} />
        <input type="hidden" name="category" value={category} />

        <label>
          Status
          <select
            name="questStatus"
            defaultValue={currentStatus ?? ""}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || "open-default"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {currentStatus && (
          <p className="uwe-hint">
            Aktuell: {QUEST_LIFECYCLE_LABELS[currentStatus as QuestLifecycleStatus]}
          </p>
        )}

        <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
          Quest-Status speichern
        </button>
      </form>
    </CollapsibleSection>
  );
}
