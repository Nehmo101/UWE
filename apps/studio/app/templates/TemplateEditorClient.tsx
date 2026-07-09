"use client";

import { useMemo, useState } from "react";
import {
  BLOCK_TYPE_LABELS,
  PAGE_TYPE_LABELS,
  VISIBILITY_LABELS,
} from "@uwe/shared-ui";
import {
  ContentBlockTypeEnum,
  PageTypeEnum,
  VisibilityEnum,
  type PageTemplateView,
} from "@uwe/database/server";
import { TemplateLivePreview, type TemplatePreviewBlock } from "./TemplateLivePreview";

interface Props {
  template: PageTemplateView | null;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
}

function initialBlocks(template: PageTemplateView | null): TemplatePreviewBlock[] {
  const existing =
    template?.blocks.map((block) => ({
      type: block.type,
      visibility: block.visibility,
      content: block.content,
    })) ?? [];
  return [...existing, { type: "rich_text", visibility: "dm_only", content: "" }];
}

export function TemplateEditorClient({ template, action, submitLabel }: Props) {
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [pageType, setPageType] = useState(template?.pageType ?? "lore");
  const [defaultVisibility, setDefaultVisibility] = useState(
    template?.defaultVisibility ?? "dm_only",
  );
  const [titlePlaceholder, setTitlePlaceholder] = useState(template?.titlePlaceholder ?? "");
  const [blocks, setBlocks] = useState<TemplatePreviewBlock[]>(() => initialBlocks(template));

  const previewBlocks = useMemo(
    () => blocks.filter((block) => block.content.trim().length > 0),
    [blocks],
  );

  function updateBlock(index: number, patch: Partial<TemplatePreviewBlock>) {
    setBlocks((current) =>
      current.map((block, i) => (i === index ? { ...block, ...patch } : block)),
    );
  }

  function addBlock() {
    setBlocks((current) => [
      ...current,
      { type: "rich_text", visibility: "dm_only", content: "" },
    ]);
  }

  return (
    <div className="uwe-template-editor-split" style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "minmax(0, 1fr) minmax(16rem, 22rem)" }}>
      <form action={action} className="uwe-form" style={{ maxWidth: "48rem" }}>
        {template ? <input type="hidden" name="templateId" value={template.id} /> : null}

        <label>
          Name
          <input name="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label>
          Beschreibung
          <input
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <label>
          Seitentyp
          <select
            name="pageType"
            value={pageType}
            onChange={(e) => setPageType(e.target.value as PageTemplateView["pageType"])}
          >
            {Object.values(PageTypeEnum).map((type) => (
              <option key={type} value={type}>
                {PAGE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Standard-Sichtbarkeit
          <select
            name="defaultVisibility"
            value={defaultVisibility}
            onChange={(e) =>
              setDefaultVisibility(e.target.value as PageTemplateView["defaultVisibility"])
            }
          >
            {Object.values(VisibilityEnum).map((v) => (
              <option key={v} value={v}>
                {VISIBILITY_LABELS[v]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Titel-Platzhalter
          <input
            name="titlePlaceholder"
            value={titlePlaceholder}
            onChange={(e) => setTitlePlaceholder(e.target.value)}
          />
        </label>

        <h2 style={{ fontSize: "1rem", margin: "0.5rem 0 0" }}>Blöcke</h2>

        {blocks.map((block, index) => (
          <fieldset key={index} className="uwe-template-block-fieldset">
            <legend>Block {index + 1}</legend>
            <label>
              Typ
              <select
                name={`blockType_${index}`}
                value={block.type}
                onChange={(e) => updateBlock(index, { type: e.target.value })}
              >
                {Object.values(ContentBlockTypeEnum).map((type) => (
                  <option key={type} value={type}>
                    {BLOCK_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sichtbarkeit
              <select
                name={`blockVisibility_${index}`}
                value={block.visibility}
                onChange={(e) => updateBlock(index, { visibility: e.target.value })}
              >
                {Object.values(VisibilityEnum).map((v) => (
                  <option key={v} value={v}>
                    {VISIBILITY_LABELS[v]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Inhalt
              <textarea
                name={`blockContent_${index}`}
                rows={6}
                value={block.content}
                onChange={(e) => updateBlock(index, { content: e.target.value })}
              />
            </label>
            {template && index < (template.blocks.length ?? 0) ? (
              <label style={{ flexDirection: "row", display: "flex", gap: "0.4rem", alignItems: "center" }}>
                <input type="checkbox" name={`blockRemove_${index}`} />
                Block entfernen
              </label>
            ) : index === blocks.length - 1 && !block.content.trim() ? (
              <input type="hidden" name={`blockNew_${index}`} value="1" />
            ) : null}
          </fieldset>
        ))}

        <button type="button" className="uwe-v2-btn uwe-v2-btn-secondary" onClick={addBlock}>
          + Block
        </button>

        <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary" style={{ marginTop: "1rem" }}>
          {submitLabel}
        </button>
      </form>

      <TemplateLivePreview
        name={name}
        description={description}
        titlePlaceholder={titlePlaceholder}
        blocks={previewBlocks}
      />
    </div>
  );
}
