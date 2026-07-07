/**
 * RtxAssetReviewList — pending RTX asset review (server component).
 *
 * Lists pending `rtx_asset` AtlasPaletteItems for a world with approve/delete
 * forms on the existing atlas actions. The caller (atlas index page) must
 * re-validate `styleTags.rtxAssetProposal` server-side via
 * `validateRtxAtlasAssetProposal` and only pass validated data here — items
 * whose stored proposal fails validation are shown as invalid and can only be
 * deleted. Approving never creates AtlasObjects; it only flips reviewStatus.
 */

import type { RtxGouacheJsonRecipe } from "@uwe/atlas/rtx-asset-proposal";
import {
  approveAtlasPaletteItemAction,
  deleteAtlasPaletteItemAction,
} from "@/app/atlas-actions";
import { RtxAssetRecipePreview } from "./RtxAssetRecipePreview";

export interface RtxAssetReviewItemView {
  id: string;
  name: string;
  /** False when the stored styleTags proposal failed server-side re-validation. */
  valid: boolean;
  /** German category label from the validated proposal. */
  categoryLabel?: string;
  tags?: string[];
  engineTags?: string[];
  outputType?: "json-recipe" | "png-fallback";
  /** Only set for validated json-recipe proposals. */
  recipe?: RtxGouacheJsonRecipe;
  /** Short PNG metadata label for png-fallback proposals. */
  pngLabel?: string;
}

const chip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.1rem 0.5rem",
  border: "1px solid var(--uwe-border)",
  borderRadius: 999,
  fontSize: 11,
  background: "var(--uwe-surface)",
};

export function RtxAssetReviewList({
  worldSlug,
  items,
}: {
  worldSlug: string;
  items: RtxAssetReviewItemView[];
}) {
  return (
    <ul
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      {items.map((item) => (
        <li
          key={item.id}
          style={{
            display: "flex",
            gap: "0.75rem",
            alignItems: "flex-start",
            padding: "0.6rem",
            border: "1px solid var(--uwe-border)",
            borderRadius: "var(--uwe-radius)",
            background: "var(--uwe-surface)",
          }}
        >
          {item.valid && item.outputType === "json-recipe" && item.recipe ? (
            <RtxAssetRecipePreview recipe={item.recipe} size={96} />
          ) : (
            <div
              style={{
                width: 96,
                height: 96,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px dashed var(--uwe-border)",
                borderRadius: 4,
                fontSize: 11,
                color: "var(--uwe-muted)",
                textAlign: "center",
              }}
            >
              {item.valid ? "PNG-Fallback (keine Rezept-Preview)" : "Ungültig"}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", alignItems: "center" }}>
              <strong style={{ fontSize: 14 }}>{item.name}</strong>
              {item.valid ? (
                <>
                  {item.categoryLabel && <span style={chip}>{item.categoryLabel}</span>}
                  {(item.engineTags ?? []).map((tag) => (
                    <span key={tag} style={chip}>{tag}</span>
                  ))}
                  {(item.tags ?? []).map((tag) => (
                    <span key={tag} style={{ ...chip, opacity: 0.75 }}>{tag}</span>
                  ))}
                </>
              ) : (
                <span style={{ ...chip, color: "var(--uwe-danger)" }}>
                  Proposal ungültig — nur Löschen möglich
                </span>
              )}
            </div>
            {item.valid && item.outputType === "png-fallback" && item.pngLabel && (
              <span style={{ fontSize: 12, color: "var(--uwe-muted)" }}>{item.pngLabel}</span>
            )}

            <div style={{ display: "flex", gap: "0.5rem" }}>
              {item.valid && (
                <form action={approveAtlasPaletteItemAction}>
                  <input type="hidden" name="worldSlug" value={worldSlug} />
                  <input type="hidden" name="itemId" value={item.id} />
                  <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
                    Genehmigen
                  </button>
                </form>
              )}
              <form action={deleteAtlasPaletteItemAction}>
                <input type="hidden" name="worldSlug" value={worldSlug} />
                <input type="hidden" name="itemId" value={item.id} />
                <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary">
                  Löschen
                </button>
              </form>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
