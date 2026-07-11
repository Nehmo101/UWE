"use client";

import { useMemo, useState } from "react";
import {
  BLOCK_TYPE_LABELS,
  PAGE_TYPE_LABELS,
  VISIBILITY_LABELS,
} from "@uwe/shared-ui";
import { TemplateLivePreview, type TemplatePreviewBlock } from "./TemplateLivePreview";
import { Button, Input, Label, Textarea } from "@/src/components/ui";

/** TODO(design-kit): natives select bleibt — controlled Feldwahl (Seitentyp,
    Sichtbarkeit, Block-Typ), siehe gleiches Muster in ReviewWorkspace.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
/** TODO(design-kit): kein Checkbox-Kit-Component vorhanden — natives input[type=checkbox] + Tailwind verwendet. */
const CHECKBOX_ROW_CLASS = "flex items-center gap-2 text-sm";
const CHECKBOX_CLASS = "size-4 rounded border-input";

type TemplatePageType = keyof typeof PAGE_TYPE_LABELS;
type TemplateVisibility = keyof typeof VISIBILITY_LABELS;
type TemplateBlockType = keyof typeof BLOCK_TYPE_LABELS;

interface PageTemplateEditorModel {
  id: string;
  name: string;
  description: string;
  pageType: TemplatePageType;
  defaultVisibility: TemplateVisibility;
  titlePlaceholder: string;
  blocks: Array<{ type: TemplateBlockType; visibility: TemplateVisibility; content: string }>;
}

interface Props {
  template: PageTemplateEditorModel | null;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
}

function initialBlocks(template: PageTemplateEditorModel | null): TemplatePreviewBlock[] {
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
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] gap-6">
      <form action={action} className="flex max-w-3xl flex-col gap-4">
        {template ? <input type="hidden" name="templateId" value={template.id} /> : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="template-editor-name">Name</Label>
          <Input
            id="template-editor-name"
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="template-editor-description">Beschreibung</Label>
          <Input
            id="template-editor-description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="template-editor-page-type">Seitentyp</Label>
          <select
            id="template-editor-page-type"
            name="pageType"
            value={pageType}
            onChange={(e) => setPageType(e.target.value as TemplatePageType)}
            className={NATIVE_SELECT_CLASS}
          >
            {(Object.keys(PAGE_TYPE_LABELS) as TemplatePageType[]).map((type) => (
              <option key={type} value={type}>
                {PAGE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="template-editor-default-visibility">Standard-Sichtbarkeit</Label>
          <select
            id="template-editor-default-visibility"
            name="defaultVisibility"
            value={defaultVisibility}
            onChange={(e) =>
              setDefaultVisibility(e.target.value as TemplateVisibility)
            }
            className={NATIVE_SELECT_CLASS}
          >
            {(Object.keys(VISIBILITY_LABELS) as TemplateVisibility[]).map((v) => (
              <option key={v} value={v}>
                {VISIBILITY_LABELS[v]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="template-editor-title-placeholder">Titel-Platzhalter</Label>
          <Input
            id="template-editor-title-placeholder"
            name="titlePlaceholder"
            value={titlePlaceholder}
            onChange={(e) => setTitlePlaceholder(e.target.value)}
          />
        </div>

        <h2 className="mt-2 text-base font-semibold tracking-tight">Blöcke</h2>

        {blocks.map((block, index) => (
          <fieldset key={index} className="flex flex-col gap-3 rounded-[var(--radius)] border border-border p-4">
            <legend className="px-1 text-sm text-muted-foreground">Block {index + 1}</legend>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`template-editor-block-${index}-type`}>Typ</Label>
              <select
                id={`template-editor-block-${index}-type`}
                name={`blockType_${index}`}
                value={block.type}
                onChange={(e) => updateBlock(index, { type: e.target.value })}
                className={NATIVE_SELECT_CLASS}
              >
                {Object.keys(BLOCK_TYPE_LABELS).map((type) => (
                  <option key={type} value={type}>
                    {BLOCK_TYPE_LABELS[type as TemplateBlockType]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`template-editor-block-${index}-visibility`}>Sichtbarkeit</Label>
              <select
                id={`template-editor-block-${index}-visibility`}
                name={`blockVisibility_${index}`}
                value={block.visibility}
                onChange={(e) => updateBlock(index, { visibility: e.target.value })}
                className={NATIVE_SELECT_CLASS}
              >
                {(Object.keys(VISIBILITY_LABELS) as TemplateVisibility[]).map((v) => (
                  <option key={v} value={v}>
                    {VISIBILITY_LABELS[v]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`template-editor-block-${index}-content`}>Inhalt</Label>
              <Textarea
                id={`template-editor-block-${index}-content`}
                name={`blockContent_${index}`}
                rows={6}
                value={block.content}
                onChange={(e) => updateBlock(index, { content: e.target.value })}
              />
            </div>
            {template && index < (template.blocks.length ?? 0) ? (
              <label className={CHECKBOX_ROW_CLASS}>
                <input type="checkbox" name={`blockRemove_${index}`} className={CHECKBOX_CLASS} />
                Block entfernen
              </label>
            ) : index === blocks.length - 1 && !block.content.trim() ? (
              <input type="hidden" name={`blockNew_${index}`} value="1" />
            ) : null}
          </fieldset>
        ))}

        <Button type="button" variant="secondary" onClick={addBlock} className="self-start">
          + Block
        </Button>

        <Button type="submit" className="mt-4 self-start">
          {submitLabel}
        </Button>
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
