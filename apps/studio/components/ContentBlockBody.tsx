"use client";

import { useState } from "react";
import { RichTextBlockEditor } from "./RichTextBlockEditor";
import { ContentBlockImageField, type BlockImageAsset } from "./ContentBlockImageField";

const RICH_TEXT_TYPES = new Set(["rich_text", "rich_text"]);

export interface BlockTypeOption {
  value: string;
  label: string;
}

interface ContentBlockBodyProps {
  worldSlug: string;
  typeOptions: BlockTypeOption[];
  imageAssets: BlockImageAsset[];
  defaultType?: string;
  defaultContent?: string;
  defaultAssetId?: string | null;
  rows?: number;
  /**
   * Präfix für die Feldnamen (`type`, `content`, `assetId`) — nötig, wenn
   * mehrere Blöcke im selben Formular stecken (z. B. `blocks.<id>.`).
   */
  fieldPrefix?: string;
}

/**
 * Reaktiver Block-Editor: der gewählte Block-Typ entscheidet clientseitig,
 * welches Eingabefeld erscheint — Rich-Text-Editor, Bild-Auswahl (mit Upload)
 * oder ein einfaches Textfeld. Rendert das `type`-Select selbst, damit ein
 * Wechsel sofort das passende Feld zeigt.
 */
export function ContentBlockBody({
  worldSlug,
  typeOptions,
  imageAssets,
  defaultType = "rich_text",
  defaultContent = "",
  defaultAssetId = null,
  rows = 6,
  fieldPrefix = "",
}: ContentBlockBodyProps) {
  const [type, setType] = useState(defaultType);

  return (
    <>
      <label>
        Block-Typ
        <select
          name={`${fieldPrefix}type`}
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {type === "image" ? (
        <ContentBlockImageField
          worldSlug={worldSlug}
          assets={imageAssets}
          assetIdName={`${fieldPrefix}assetId`}
          captionName={`${fieldPrefix}content`}
          defaultAssetId={defaultAssetId}
          defaultCaption={defaultContent}
        />
      ) : RICH_TEXT_TYPES.has(type) ? (
        <label>
          Inhalt
          <RichTextBlockEditor
            name={`${fieldPrefix}content`}
            defaultValue={defaultContent}
            rows={rows}
          />
        </label>
      ) : (
        <label>
          Inhalt
          <textarea name={`${fieldPrefix}content`} defaultValue={defaultContent} rows={rows} />
        </label>
      )}
    </>
  );
}
