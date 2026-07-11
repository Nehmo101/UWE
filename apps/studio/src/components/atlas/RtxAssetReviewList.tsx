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
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

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

export function RtxAssetReviewList({
  worldSlug,
  items,
}: {
  worldSlug: string;
  items: RtxAssetReviewItemView[];
}) {
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {items.map((item) => (
        <li key={item.id}>
          <Card>
            <CardContent className="flex items-start gap-3 p-4">
              {item.valid && item.outputType === "json-recipe" && item.recipe ? (
                <RtxAssetRecipePreview recipe={item.recipe} size={96} />
              ) : (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded border border-dashed border-border text-center text-[11px] text-muted-foreground">
                  {item.valid ? "PNG-Fallback (keine Rezept-Preview)" : "Ungültig"}
                </div>
              )}

              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-1">
                  <strong className="text-sm">{item.name}</strong>
                  {item.valid ? (
                    <>
                      {item.categoryLabel && <Badge>{item.categoryLabel}</Badge>}
                      {(item.engineTags ?? []).map((tag) => (
                        <Badge key={tag}>{tag}</Badge>
                      ))}
                      {(item.tags ?? []).map((tag) => (
                        <Badge key={tag} className="opacity-75">
                          {tag}
                        </Badge>
                      ))}
                    </>
                  ) : (
                    <Badge variant="danger">Proposal ungültig — nur Löschen möglich</Badge>
                  )}
                </div>
                {item.valid && item.outputType === "png-fallback" && item.pngLabel && (
                  <span className="text-xs text-muted-foreground">{item.pngLabel}</span>
                )}

                <div className="flex gap-2">
                  {item.valid && (
                    <form action={approveAtlasPaletteItemAction}>
                      <input type="hidden" name="worldSlug" value={worldSlug} />
                      <input type="hidden" name="itemId" value={item.id} />
                      <Button type="submit">Genehmigen</Button>
                    </form>
                  )}
                  <form action={deleteAtlasPaletteItemAction}>
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <Button type="submit" variant="secondary">
                      Löschen
                    </Button>
                  </form>
                </div>
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
