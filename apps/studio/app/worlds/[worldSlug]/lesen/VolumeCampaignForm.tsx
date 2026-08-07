import type { VolumeCandidate } from "@uwe/database/campaign";

import { Button, Input } from "@/src/components/ui";

import { attachVolumeToCampaignAction, createCampaignFromVolumeAction } from "./volume-campaign-actions";

interface Props {
  worldSlug: string;
  volume: VolumeCandidate;
  /** Dungeon-Bände der Welt, die man diesem Band mitgeben kann. */
  dungeons: VolumeCandidate[];
  campaigns: Array<{ id: string; name: string }>;
}

/**
 * Der Knopf, der aus einem Band eine Kampagne macht.
 *
 * Zwei Formen, je nachdem, was der Band ist:
 *
 * - **Ein Buch** bekommt „Kampagne daraus machen" samt Kästchen für die
 *   Dungeon-Bände der Welt. Ein Kampagnenbuch und seine Dungeons liegen im
 *   Import getrennt vor — sie gehören aber zusammen, und niemand will das
 *   hinterher an fünfhundert Seiten von Hand nachtragen.
 * - **Ein Dungeon** bekommt „einer Kampagne zuschlagen", weil ein Dungeon
 *   selten eine eigene Kampagne ist.
 *
 * Bände, die schon zu einer Kampagne gehören, zeigen nur, zu welcher.
 */
export function VolumeCampaignForm({ worldSlug, volume, dungeons, campaigns }: Props) {
  if (volume.campaignName) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        Kampagne: <span className="font-medium">{volume.campaignName}</span>
      </p>
    );
  }

  if (volume.isDungeon) {
    if (campaigns.length === 0) {
      return (
        <p className="mt-3 text-xs text-muted-foreground">
          Noch keine Kampagne in dieser Welt, der sich dieser Dungeon zuschlagen ließe.
        </p>
      );
    }

    return (
      <form action={attachVolumeToCampaignAction} className="mt-3 flex flex-wrap items-center gap-2">
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="volumePageId" value={volume.pageId} />
        <label className="sr-only" htmlFor={`kampagne-${volume.pageId}`}>
          Kampagne für {volume.title}
        </label>
        <select
          id={`kampagne-${volume.pageId}`}
          name="campaignId"
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          defaultValue=""
        >
          <option value="" disabled>
            Kampagne wählen…
          </option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="secondary">
          Als Dungeon zuschlagen
        </Button>
      </form>
    );
  }

  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
        Kampagne daraus machen
      </summary>
      <form action={createCampaignFromVolumeAction} className="mt-2 flex flex-col gap-2">
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="volumePageId" value={volume.pageId} />
        <label className="sr-only" htmlFor={`name-${volume.pageId}`}>
          Name der Kampagne
        </label>
        <Input
          id={`name-${volume.pageId}`}
          name="name"
          defaultValue={volume.title}
          placeholder="Name der Kampagne"
          className="h-8 text-xs"
        />
        {dungeons.length > 0 ? (
          <fieldset className="flex flex-col gap-1">
            <legend className="text-xs text-muted-foreground">Dungeons, die dazugehören</legend>
            {dungeons.map((dungeon) => (
              <label key={dungeon.pageId} className="flex items-center gap-2 text-xs">
                <input type="checkbox" name="dungeonPageIds" value={dungeon.pageId} />
                {dungeon.title}
                <span className="text-muted-foreground">({dungeon.pageCount} Seiten)</span>
              </label>
            ))}
          </fieldset>
        ) : null}
        <Button type="submit" size="sm">
          Kampagne anlegen und {volume.pageCount} Seiten zuordnen
        </Button>
      </form>
    </details>
  );
}
