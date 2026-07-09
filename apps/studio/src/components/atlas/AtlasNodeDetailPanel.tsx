"use client";

import Link from "next/link";
import {
  setAtlasNodeVisibilityAction,
  updateAtlasNodeAction,
} from "@/app/atlas-actions";

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
    <section
      className="uwe-v2-card"
      style={{
        marginBottom: "0.75rem",
        display: "grid",
        gap: "0.75rem",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 14rem), 1fr))",
        alignItems: "start",
      }}
    >
      <div>
        <h2 style={{ margin: "0 0 0.35rem", fontSize: "1rem" }}>Knoten</h2>
        <p className="uwe-hint" style={{ margin: 0 }}>
          {levelLabel}
          {parentTitle && parentId ? (
            <>
              {" "}
              · Unter{" "}
              <Link href={`/worlds/${worldSlug}/atlas/${parentId}`}>{parentTitle}</Link>
            </>
          ) : null}
        </p>
        <p className="uwe-hint" style={{ margin: "0.35rem 0 0" }}>
          {featureCount} Feature{featureCount === 1 ? "" : "s"} · {objectCount} Objekt
          {objectCount === 1 ? "" : "e"}
        </p>
        {linkedPageTitle && linkedPageHref && (
          <p className="uwe-hint" style={{ margin: "0.35rem 0 0" }}>
            Wiki: <Link href={linkedPageHref}>{linkedPageTitle}</Link>
          </p>
        )}
      </div>

      <form action={updateAtlasNodeAction} className="uwe-v2-form" style={{ margin: 0 }}>
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="nodeId" value={nodeId} />
        <label>
          Titel
          <input name="title" defaultValue={title} required />
        </label>
        <label>
          Sortierung
          <input name="sortOrder" type="number" min={0} step={1} defaultValue={sortOrder} />
        </label>
        <button type="submit" className="uwe-v2-btn uwe-v2-btn-sm">
          Speichern
        </button>
      </form>

      <form action={setAtlasNodeVisibilityAction} className="uwe-v2-form" style={{ margin: 0 }}>
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="nodeId" value={nodeId} />
        <label>
          Portal-Sichtbarkeit
          <select name="visibility" defaultValue={isPlayerVisible ? "player_visible" : "dm_only"}>
            <option value="dm_only">Nur DM</option>
            <option value="player_visible">Spieler sichtbar</option>
          </select>
        </label>
        <button type="submit" className="uwe-v2-btn uwe-v2-btn-sm">
          Sichtbarkeit setzen
        </button>
      </form>
    </section>
  );
}
