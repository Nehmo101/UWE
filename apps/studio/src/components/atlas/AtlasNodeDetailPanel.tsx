import Link from "next/link";
import {
  setAtlasNodeVisibilityAction,
  updateAtlasNodeAction,
} from "@/app/atlas-actions";
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui";

const LEVEL_LABELS: Record<string, string> = {
  globe: "Globus",
  continent: "Kontinent",
  landscape: "Landschaft",
  city: "Stadt",
};

interface Props {
  worldSlug: string;
  nodeId: string;
  title: string;
  level: string;
  visibility: string;
  sortOrder: number;
  featureCount: number;
  objectCount: number;
  parentTitle?: string | null;
  parentId?: string | null;
  linkedPageTitle?: string | null;
  linkedPageHref?: string | null;
}

export function AtlasNodeDetailPanel({
  worldSlug,
  nodeId,
  title,
  level,
  visibility,
  sortOrder,
  featureCount,
  objectCount,
  parentTitle,
  parentId,
  linkedPageTitle,
  linkedPageHref,
}: Props) {
  const levelLabel = LEVEL_LABELS[level] ?? level;
  const isPlayerVisible = visibility === "player_visible" || visibility === "public";

  return (
    <Card className="mb-3">
      <CardContent className="grid items-start gap-3 pt-6 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))]">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-base font-semibold tracking-tight">Knoten</h2>
          <p className="text-sm text-muted-foreground">
            {levelLabel}
            {parentTitle && parentId ? (
              <>
                {" "}
                · Unter{" "}
                <Link href={`/worlds/${worldSlug}/atlas/${parentId}`}>{parentTitle}</Link>
              </>
            ) : null}
          </p>
          <p className="text-sm text-muted-foreground">
            {featureCount} Feature{featureCount === 1 ? "" : "s"} · {objectCount} Objekt
            {objectCount === 1 ? "" : "e"}
          </p>
          {linkedPageTitle && linkedPageHref && (
            <p className="text-sm text-muted-foreground">
              Wiki: <Link href={linkedPageHref}>{linkedPageTitle}</Link>
            </p>
          )}
        </div>

        <form action={updateAtlasNodeAction} className="flex flex-col gap-3">
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <input type="hidden" name="nodeId" value={nodeId} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="atlas-node-title">Titel</Label>
            <Input id="atlas-node-title" name="title" defaultValue={title} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="atlas-node-sort-order">Sortierung</Label>
            <Input
              id="atlas-node-sort-order"
              name="sortOrder"
              type="number"
              min={0}
              step={1}
              defaultValue={sortOrder}
            />
          </div>
          <Button type="submit" size="sm" className="self-start">
            Speichern
          </Button>
        </form>

        <form action={setAtlasNodeVisibilityAction} className="flex flex-col gap-3">
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <input type="hidden" name="nodeId" value={nodeId} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="atlas-node-visibility">Portal-Sichtbarkeit</Label>
            <Select name="visibility" defaultValue={isPlayerVisible ? "player_visible" : "dm_only"}>
              <SelectTrigger id="atlas-node-visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dm_only">Nur DM</SelectItem>
                <SelectItem value="player_visible">Spieler sichtbar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" size="sm" className="self-start">
            Sichtbarkeit setzen
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
