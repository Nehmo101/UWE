import Link from "next/link";
import type { MiniatureCollectionItem, MiniatureCollectionStatus } from "@uwe/database/server";
import {
  MINIATURE_COLLECTION_STATUS_LABELS,
  MiniatureCollectionStatusEnum,
} from "@uwe/database/server";
import {
  createMiniatureAction,
  deleteMiniatureAction,
  updateMiniatureAction,
} from "@/app/miniature-actions";
import { MiniaturePhotoCompare } from "./MiniaturePhotoCompare";
import { Button, Input, Label, Textarea } from "@/src/components/ui";

/** TODO(design-kit): natives Select bleibt — Server-Action-Formular (FormData)
    braucht name/defaultValue ohne Client-State, siehe PageChroniclePanel.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

interface WorkshopOption {
  id: string;
  title: string;
}

interface Props {
  item?: MiniatureCollectionItem;
  workshopProjects: WorkshopOption[];
  mode: "create" | "edit";
}

function asComparePhotoAssetIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

export function MiniatureCollectionPanel({ item, workshopProjects, mode }: Props) {
  const action = mode === "create" ? createMiniatureAction : updateMiniatureAction;
  const comparePhotoAssetIds = item ? asComparePhotoAssetIds(item.comparePhotoAssetIds) : [];
  const idPrefix = `miniature-${item?.id ?? "new"}`;

  return (
    <>
      <form action={action} className="flex flex-col gap-4">
        {item ? <input type="hidden" name="id" value={item.id} /> : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-name`}>Name</Label>
          <Input id={`${idPrefix}-name`} name="name" defaultValue={item?.name ?? ""} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-manufacturer`}>Hersteller</Label>
          <Input id={`${idPrefix}-manufacturer`} name="manufacturer" defaultValue={item?.manufacturer ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-game-system`}>Spielsystem</Label>
          <Input id={`${idPrefix}-game-system`} name="gameSystem" defaultValue={item?.gameSystem ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-faction`}>Fraktion</Label>
          <Input id={`${idPrefix}-faction`} name="faction" defaultValue={item?.faction ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-quantity`}>Anzahl</Label>
          <Input
            id={`${idPrefix}-quantity`}
            name="quantity"
            type="number"
            min={1}
            defaultValue={item?.quantity ?? 1}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-status`}>Status</Label>
          <select
            id={`${idPrefix}-status`}
            name="status"
            defaultValue={item?.status ?? "purchased"}
            className={NATIVE_SELECT_CLASS}
          >
            {Object.values(MiniatureCollectionStatusEnum).map((status) => (
              <option key={status} value={status}>
                {MINIATURE_COLLECTION_STATUS_LABELS[status as MiniatureCollectionStatus]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-notes`}>Notizen</Label>
          <Textarea id={`${idPrefix}-notes`} name="notes" rows={3} defaultValue={item?.notes ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-workshop-project`}>Werkstatt-Projekt (optional)</Label>
          <select
            id={`${idPrefix}-workshop-project`}
            name="workshopProjectId"
            defaultValue={item?.workshopProjectId ?? ""}
            className={NATIVE_SELECT_CLASS}
          >
            <option value="">— kein Projekt —</option>
            {workshopProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </div>
        {item?.workshopProjectId ? (
          <p className="text-sm text-muted-foreground">
            Verknüpftes Projekt:{" "}
            <Link href={`/workshop/${item.workshopProjectId}`}>Werkstatt-Cockpit öffnen</Link>
          </p>
        ) : null}

        <MiniaturePhotoCompare
          referenceImageAssetId={item?.referenceImageAssetId}
          comparePhotoAssetIds={comparePhotoAssetIds}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit">{mode === "create" ? "Miniatur anlegen" : "Speichern"}</Button>
        </div>
      </form>
      {mode === "edit" && item ? (
        <form action={deleteMiniatureAction}>
          <input type="hidden" name="id" value={item.id} />
          <Button type="submit" variant="secondary">
            Löschen
          </Button>
        </form>
      ) : null}
    </>
  );
}
