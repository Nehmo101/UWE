import Link from "next/link";
import { QUEST_LIFECYCLE_LABELS, type QuestLifecycleStatus } from "@uwe/database/server";
import { assignQuestToGroupAction } from "@/app/worlds/[worldSlug]/gruppen-actions";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";

export interface QuestGroupAssignmentQuest {
  id: string;
  title: string;
  href: string;
  questStatus: QuestLifecycleStatus | null;
  questGroupId: string | null;
  portalReleased: boolean;
}

export interface QuestGroupAssignmentGroup {
  id: string;
  name: string;
}

interface Props {
  worldSlug: string;
  returnTo: string;
  quests: QuestGroupAssignmentQuest[];
  groups: QuestGroupAssignmentGroup[];
}

/**
 * Quest-Zuordnung — wer bekommt welche Quest ins Portal-Questlog?
 *
 * Das Questlog im Portal zeigt seit dieser Runde ausschließlich Quests mit
 * gesetzter Gruppe, und nur die der eigenen. Eine Quest ohne Zuordnung ist
 * damit DM-Material: im Studio sichtbar, im Portal nicht. Hier vergibt der
 * Spielleiter sie — bewusst im Radar, weil hier ohnehin steht, was gerade
 * läuft.
 *
 * Die Freigabe (`portalReleased`) bleibt eine zweite, unabhängige Bedingung.
 * Beides muss stimmen, sonst sieht die Runde nichts — deshalb der Hinweis an
 * der Zeile statt einer stillen Leerstelle im Portal.
 */
export function QuestGroupAssignmentCard({ worldSlug, returnTo, quests, groups }: Props) {
  return (
    <Card id="radar-quest-gruppen">
      <CardHeader>
        <CardTitle>Quests → Tischrunde</CardTitle>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Diese Welt hat noch keine Spielergruppe.{" "}
            <Link href={`/worlds/${worldSlug}/gruppen`}>Erst eine Runde anlegen →</Link>
          </p>
        ) : quests.length === 0 ? (
          <p className="text-sm text-muted-foreground">Diese Welt hat noch keine Quest-Seiten.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              Ohne Zuordnung bleibt eine Quest im Portal unsichtbar — auch wenn sie freigegeben
              ist.
            </p>
            <ul className="flex flex-col gap-2">
              {quests.map((quest) => (
                <li
                  key={quest.id}
                  className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-border px-3 py-2 text-sm"
                >
                  <Link href={quest.href} className="font-medium">
                    {quest.title}
                  </Link>
                  <Badge variant="secondary">
                    {QUEST_LIFECYCLE_LABELS[(quest.questStatus ?? "open") as QuestLifecycleStatus]}
                  </Badge>
                  {!quest.portalReleased ? (
                    <Badge variant="default">nicht freigegeben</Badge>
                  ) : null}

                  <form action={assignQuestToGroupAction} className="ml-auto flex items-center gap-2">
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="pageId" value={quest.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <label className="sr-only" htmlFor={`quest-group-${quest.id}`}>
                      Tischrunde für {quest.title}
                    </label>
                    <select
                      id={`quest-group-${quest.id}`}
                      name="groupId"
                      defaultValue={quest.questGroupId ?? ""}
                      className="h-8 rounded-[var(--radius)] border border-input bg-transparent px-2 text-sm"
                    >
                      <option value="">— keine Runde —</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" variant="ghost" size="sm">
                      Zuordnen
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
