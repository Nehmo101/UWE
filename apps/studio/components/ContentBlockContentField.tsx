"use client";

import { RichTextBlockEditor } from "./RichTextBlockEditor";

const RICH_TEXT_TYPES = new Set(["rich_text", "gm_note"]);

interface ContentBlockContentFieldProps {
  blockType: string;
  name?: string;
  defaultValue?: string;
  rows?: number;
}

export function ContentBlockContentField({
  blockType,
  name = "content",
  defaultValue = "",
  rows = 6,
}: ContentBlockContentFieldProps) {
  if (RICH_TEXT_TYPES.has(blockType)) {
    return (
      <label>
        Inhalt
        <RichTextBlockEditor name={name} defaultValue={defaultValue} rows={rows} />
      </label>
    );
  }

  return (
    <label>
      Inhalt
      <textarea name={name} defaultValue={defaultValue} rows={rows} />
    </label>
  );
}
