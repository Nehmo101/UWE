"use client";

import { BLOCK_TYPE_LABELS, VISIBILITY_LABELS } from "@uwe/shared-ui";

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
    <aside className="uwe-v2-card uwe-v2-card-padded uwe-template-live-preview">
      <h2 className="uwe-v2-section-title">Live-Vorschau</h2>
      <article>
        <h3 style={{ marginTop: 0 }}>{name.trim() || "Neues Template"}</h3>
        {description.trim() ? <p className="uwe-dashboard-muted">{description}</p> : null}
        {titlePlaceholder.trim() ? (
          <p className="uwe-hint">Titel-Platzhalter: {titlePlaceholder}</p>
        ) : null}
        {visibleBlocks.length === 0 ? (
          <p className="uwe-dashboard-muted">Blöcke erscheinen hier sobald Inhalt eingegeben wird.</p>
        ) : (
          visibleBlocks.map((block, index) => (
            <section key={index} className="uwe-v2-section" style={{ marginBottom: "0.75rem" }}>
              <p className="uwe-dashboard-muted" style={{ fontSize: "0.8rem" }}>
                {BLOCK_TYPE_LABELS[block.type as keyof typeof BLOCK_TYPE_LABELS] ?? block.type}
                {" · "}
                {VISIBILITY_LABELS[block.visibility as keyof typeof VISIBILITY_LABELS] ?? block.visibility}
              </p>
              <div style={{ whiteSpace: "pre-wrap" }}>{block.content}</div>
            </section>
          ))
        )}
      </article>
    </aside>
  );
}
