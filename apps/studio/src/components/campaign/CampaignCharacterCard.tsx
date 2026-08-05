import { assignCharacterToCampaignAction } from "@/app/worlds/[worldSlug]/character-campaign-actions";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";

export interface CampaignCharacterRow {
  id: string;
  displayName: string;
  ownerDisplayName: string;
  level: number;
  campaignId: string | null;
}

interface Props {
  worldSlug: string;
  campaignId: string;
  campaignName: string;
  returnTo: string;
  /** Alle Charaktere der Welt — zugewiesene wie freie. */
  characters: CampaignCharacterRow[];
}

/**
 * Charaktere dieser Kampagne.
 *
 * Angelegt wird ein Charakter im Portal, von seinem Spieler. Hier steht nur
 * die eine Entscheidung, die dem Spielleiter gehört: spielt dieser Charakter
 * in dieser Kampagne mit? Deshalb zwei Listen statt eines Formulars — was
 * dabei ist, und was sich dazuholen ließe.
 */
export function CampaignCharacterCard({
  worldSlug,
  campaignId,
  campaignName,
  returnTo,
  characters,
}: Props) {
  const assigned = characters.filter((character) => character.campaignId === campaignId);
  const available = characters.filter((character) => character.campaignId !== campaignId);

  return (
    <Card id="cockpit-charaktere">
      <CardHeader>
        <CardTitle>Charaktere</CardTitle>
      </CardHeader>
      <CardContent>
        {characters.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            In dieser Welt gibt es noch keine Charakterbögen. Spieler legen sie im Portal unter
            „Meine Charaktere“ an.
          </p>
        ) : (
          <>
            <ul className="flex flex-col gap-2 text-sm">
              {assigned.length === 0 ? (
                <li className="text-muted-foreground">
                  Noch kein Charakter in „{campaignName}“.
                </li>
              ) : (
                assigned.map((character) => (
                  <li key={character.id} className="flex flex-wrap items-center gap-2">
                    <strong>{character.displayName}</strong>
                    <Badge variant="secondary">Stufe {character.level}</Badge>
                    <span className="text-muted-foreground">{character.ownerDisplayName}</span>
                    <form
                      action={assignCharacterToCampaignAction}
                      className="ml-auto inline-flex"
                    >
                      <input type="hidden" name="worldSlug" value={worldSlug} />
                      <input type="hidden" name="characterId" value={character.id} />
                      <input type="hidden" name="campaignId" value="" />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <Button type="submit" variant="ghost" size="sm">
                        Entfernen
                      </Button>
                    </form>
                  </li>
                ))
              )}
            </ul>

            {available.length > 0 ? (
              <>
                <h3 className="mt-4 text-sm font-semibold">Dazuholen</h3>
                <ul className="mt-2 flex flex-col gap-2 text-sm">
                  {available.map((character) => (
                    <li key={character.id} className="flex flex-wrap items-center gap-2">
                      <span>{character.displayName}</span>
                      <span className="text-muted-foreground">{character.ownerDisplayName}</span>
                      {character.campaignId ? (
                        <Badge variant="default">andere Kampagne</Badge>
                      ) : null}
                      <form
                        action={assignCharacterToCampaignAction}
                        className="ml-auto inline-flex"
                      >
                        <input type="hidden" name="worldSlug" value={worldSlug} />
                        <input type="hidden" name="characterId" value={character.id} />
                        <input type="hidden" name="campaignId" value={campaignId} />
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <Button type="submit" variant="ghost" size="sm">
                          Zuweisen
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
