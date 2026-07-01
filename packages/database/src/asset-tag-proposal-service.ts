import type { Asset, PrismaClient } from "./generated/prisma/client";
import { parseStringArray, toPrismaJsonValue } from "./json-utils";
import { canonicalizeTag } from "./tag-service";

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "für",
  "und",
  "der",
  "die",
  "das",
  "ein",
  "eine",
  "mit",
  "von",
  "zu",
  "im",
  "in",
  "auf",
  "image",
  "bild",
  "asset",
  "png",
  "jpg",
  "jpeg",
  "webp",
]);

export interface AssetTagProposal {
  assetId: string;
  title: string;
  proposedTags: string[];
  source: "heuristic";
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9äöüß]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

export function proposeTagsForAsset(asset: Pick<Asset, "title" | "description" | "type" | "tags">): string[] {
  const existing = new Set(parseStringArray(asset.tags).map((tag) => canonicalizeTag(tag).toLowerCase()));
  const candidates = new Set<string>();

  for (const token of tokenize(`${asset.title} ${asset.description ?? ""}`)) {
    candidates.add(canonicalizeTag(token));
  }

  if (asset.type) {
    candidates.add(canonicalizeTag(asset.type));
  }

  return [...candidates]
    .filter((tag) => tag.length >= 2 && !existing.has(tag.toLowerCase()))
    .slice(0, 6);
}

export function proposeTagsForAssets(
  assets: Array<Pick<Asset, "id" | "title" | "description" | "type" | "tags">>,
): AssetTagProposal[] {
  return assets
    .map((asset) => ({
      assetId: asset.id,
      title: asset.title,
      proposedTags: proposeTagsForAsset(asset),
      source: "heuristic" as const,
    }))
    .filter((entry) => entry.proposedTags.length > 0);
}

export async function storeAssetTagProposals(
  db: PrismaClient,
  proposals: AssetTagProposal[],
): Promise<number> {
  let updated = 0;
  for (const proposal of proposals) {
    const asset = await db.asset.findUnique({
      where: { id: proposal.assetId },
      select: { metadata: true },
    });
    if (!asset) continue;

    const prior =
      asset.metadata && typeof asset.metadata === "object" && !Array.isArray(asset.metadata)
        ? (asset.metadata as Record<string, unknown>)
        : {};

    await db.asset.update({
      where: { id: proposal.assetId },
      data: {
        metadata: toPrismaJsonValue({
          ...prior,
          aiTagProposal: {
            tags: proposal.proposedTags,
            source: proposal.source,
            generatedAt: new Date().toISOString(),
          },
        }),
      },
    });
    updated += 1;
  }
  return updated;
}
