import "server-only";

import fs from "node:fs";

import {
  buildSecureStorageKey,
  ensureUploadDirectory,
  resolveAssetFilePath,
} from "@uwe/assets";
import {
  getSystemSettings,
  resolveEffectiveUploadsPath,
  type UweRepository,
} from "@uwe/database/server";

import { readCampaignImportFigure } from "./campaign-pdf-storage";

/**
 * Übernimmt die von der OCR zugeschnittenen Abbildungen als Assets und hängt
 * sie an die erzeugten Kampagnen-Seiten.
 *
 * Zuordnung über die PDF-Seite: eine Abbildung landet bei den Entitäten, deren
 * Quell-Chunk dieselbe Seite abdeckte (`sourcePages`). Das ist bewusst grob —
 * eine Buchseite trägt oft eine Karte und mehrere Absätze, und welcher Absatz
 * zu welcher Karte gehört, weiß niemand sicher. Lieber die Karte an allen
 * Seiten derselben PDF-Seite als gar nicht: sie ist `dm_only`, sichtbar nur im
 * Studio, und der Rollback entfernt sie mit.
 */

export interface CampaignFigureRef {
  index: number;
  pageNumber: number;
  type: string;
  width: number;
  height: number;
}

export interface CreatedCampaignPage {
  pageId: string;
  title: string;
  sourcePages: number[];
}

export interface AttachFiguresResult {
  createdAssetIds: string[];
  attachedBlocks: number;
}

/** Liest die Abbildungs-Metadaten aus `extractionMeta.figures` der Vorschau. */
export function readCampaignFigures(previewPayload: unknown): CampaignFigureRef[] {
  const record =
    previewPayload && typeof previewPayload === "object"
      ? (previewPayload as Record<string, unknown>)
      : null;
  const meta =
    record?.extractionMeta && typeof record.extractionMeta === "object"
      ? (record.extractionMeta as Record<string, unknown>)
      : null;
  if (!Array.isArray(meta?.figures)) {
    return [];
  }

  const figures: CampaignFigureRef[] = [];
  for (const entry of meta.figures) {
    if (!entry || typeof entry !== "object") continue;
    const value = entry as Record<string, unknown>;
    const index = typeof value.index === "number" ? value.index : null;
    const pageNumber = typeof value.pageNumber === "number" ? value.pageNumber : null;
    if (index == null || pageNumber == null) continue;
    figures.push({
      index,
      pageNumber,
      type: typeof value.type === "string" ? value.type : "figure",
      width: typeof value.width === "number" ? value.width : 0,
      height: typeof value.height === "number" ? value.height : 0,
    });
  }
  return figures;
}

/**
 * Legt je Abbildung höchstens ein Asset an (auch wenn sie an mehreren Seiten
 * hängt) und verknüpft es mit allen passenden Seiten.
 */
export async function attachCampaignFigures(
  repo: UweRepository,
  input: {
    jobId: string;
    worldId: string;
    campaignId: string;
    sourceFile: string;
    figures: readonly CampaignFigureRef[];
    pages: readonly CreatedCampaignPage[];
  },
): Promise<AttachFiguresResult> {
  const result: AttachFiguresResult = { createdAssetIds: [], attachedBlocks: 0 };
  if (input.figures.length === 0 || input.pages.length === 0) {
    return result;
  }

  const settings = await getSystemSettings();
  const uploadsRoot = resolveEffectiveUploadsPath(settings);
  ensureUploadDirectory(input.worldId, undefined, uploadsRoot);

  for (const figure of input.figures) {
    const targets = input.pages.filter((page) => page.sourcePages.includes(figure.pageNumber));
    if (targets.length === 0) {
      // Kein Ziel — die Entitäten dieser Seite wurden nicht übernommen.
      continue;
    }

    const buffer = await readCampaignImportFigure(input.jobId, figure.index);
    if (!buffer?.length) {
      continue;
    }

    const storageKey = buildSecureStorageKey(input.worldId, ".jpg");
    await fs.promises.writeFile(
      resolveAssetFilePath(storageKey, undefined, uploadsRoot),
      buffer,
    );

    const asset = await repo.createAsset({
      worldId: input.worldId,
      campaignId: input.campaignId,
      title: `${input.sourceFile} — Seite ${figure.pageNumber}`,
      description: `Aus dem PDF-Import ausgeschnitten (${figure.type}).`,
      type: "image",
      storageKey,
      mimeType: "image/jpeg",
      size: buffer.length,
      metadata: {
        source: "pdf-campaign-import",
        importJobId: input.jobId,
        sourceFile: input.sourceFile,
        sourcePage: figure.pageNumber,
        regionType: figure.type,
        aiRoute: "local_rtx",
      },
    });
    result.createdAssetIds.push(asset.id);

    for (const target of targets) {
      await repo.linkAssetToPage(asset.id, target.pageId);
      await repo.createContentBlock(target.pageId, {
        type: "image",
        // Hinter den Textblock des Imports (sortOrder 0).
        sortOrder: 1 + result.attachedBlocks,
        assetId: asset.id,
        // Dient als Bildunterschrift und Alternativtext im Seiten-HTML.
        content: `${input.sourceFile}, Seite ${figure.pageNumber}`,
        metadata: {
          source: "pdf-campaign-import",
          importJobId: input.jobId,
          sourcePage: figure.pageNumber,
          regionType: figure.type,
        },
      });
      result.attachedBlocks += 1;
    }
  }

  return result;
}
