"use client";

import { BLOCK_TYPE_LABELS, VISIBILITY_LABELS } from "@uwe/shared-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";

export interface TemplatePreviewBlock {
  type: string;
  visibility: string;
  content: string;
}

interface Props {
  name: string;
  description: string;
  titlePlaceholder: string;
  blocks: TemplatePreviewBlock[];
}

export function TemplateLivePreview({
  name,
  description,
  titlePlaceholder,
  blocks,
}: Props) {
  const visibleBlocks = blocks.filter((block) => block.content.trim().length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live-Vorschau</CardTitle>
      </CardHeader>
      <CardContent>
        <article>
          <h3 className="mt-0">{name.trim() || "Neues Template"}</h3>
          {description.trim() ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          {titlePlaceholder.trim() ? (
            <p className="text-sm text-muted-foreground">Titel-Platzhalter: {titlePlaceholder}</p>
          ) : null}
          {visibleBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Blöcke erscheinen hier sobald Inhalt eingegeben wird.
            </p>
          ) : (
            visibleBlocks.map((block, index) => (
              <section key={index} className="mb-3">
                <p className="text-[0.8rem] text-muted-foreground">
                  {BLOCK_TYPE_LABELS[block.type as keyof typeof BLOCK_TYPE_LABELS] ?? block.type}
                  {" · "}
                  {VISIBILITY_LABELS[block.visibility as keyof typeof VISIBILITY_LABELS] ?? block.visibility}
                </p>
                <div className="whitespace-pre-wrap">{block.content}</div>
              </section>
            ))
          )}
        </article>
      </CardContent>
    </Card>
  );
}
