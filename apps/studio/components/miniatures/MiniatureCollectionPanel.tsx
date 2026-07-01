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

  return (
    <>
      <form action={action} className="uwe-brain-create-form">
        {item ? <input type="hidden" name="id" value={item.id} /> : null}

        <label>
          Name
          <input name="name" defaultValue={item?.name ?? ""} required />
        </label>
        <label>
          Hersteller
          <input name="manufacturer" defaultValue={item?.manufacturer ?? ""} />
        </label>
        <label>
          Spielsystem
          <input name="gameSystem" defaultValue={item?.gameSystem ?? ""} />
        </label>
        <label>
          Fraktion
          <input name="faction" defaultValue={item?.faction ?? ""} />
        </label>
        <label>
          Anzahl
          <input name="quantity" type="number" min={1} defaultValue={item?.quantity ?? 1} />
        </label>
        <label>
          Status
          <select name="status" defaultValue={item?.status ?? "purchased"}>
            {Object.values(MiniatureCollectionStatusEnum).map((status) => (
              <option key={status} value={status}>
                {MINIATURE_COLLECTION_STATUS_LABELS[status as MiniatureCollectionStatus]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Notizen
          <textarea name="notes" rows={3} defaultValue={item?.notes ?? ""} />
        </label>
        <label>
          Werkstatt-Projekt (optional)
          <select name="workshopProjectId" defaultValue={item?.workshopProjectId ?? ""}>
            <option value="">— kein Projekt —</option>
            {workshopProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </label>
        {item?.workshopProjectId ? (
          <p className="uwe-dashboard-muted">
            Verknüpftes Projekt:{" "}
            <Link href={`/workshop/${item.workshopProjectId}`}>Werkstatt-Cockpit öffnen</Link>
          </p>
        ) : null}

        <MiniaturePhotoCompare
          referenceImageAssetId={item?.referenceImageAssetId}
          comparePhotoAssetIds={comparePhotoAssetIds}
        />

        <div className="uwe-inline-actions">
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
            {mode === "create" ? "Miniatur anlegen" : "Speichern"}
          </button>
        </div>
      </form>
      {mode === "edit" && item ? (
        <form action={deleteMiniatureAction}>
          <input type="hidden" name="id" value={item.id} />
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary">
            Löschen
          </button>
        </form>
      ) : null}
    </>
  );
}
