import type {
  CanonicalStatus,
  ContentBlockType,
  PageType,
} from "@uwe/database/enums";
import { EmptyState } from "./AppShell";
import {
  BLOCK_TYPE_LABELS,
  CanonicalBadge,
  PageTypeBadge,
  TagChip,
} from "./StatusBadges";

export interface ContentBlockViewModel {
  id: string;
  type: ContentBlockType;
  sortOrder: number;
  content: string;
  assetId?: string | null;
  metadata?: Record<string, unknown> | null;
}

function readAssetIdsFromBlock(block: ContentBlockViewModel): string[] {
  const ids: string[] = [];
  if (block.assetId) {
    ids.push(block.assetId);
  }
  const metadata = block.metadata;
  if (metadata && Array.isArray(metadata.assetIds)) {
    for (const entry of metadata.assetIds) {
      if (typeof entry === "string" && entry.trim() && !ids.includes(entry)) {
        ids.push(entry);
      }
    }
  }
  return ids;
}

function renderGalleryBlock(block: ContentBlockViewModel) {
  const assetIds = readAssetIdsFromBlock(block);
  if (assetIds.length > 0) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
        {assetIds.map((assetId) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={assetId}
            src={`/api/assets/${assetId}/file`}
            alt=""
            className="w-full aspect-square object-cover rounded-md"
          />
        ))}
      </div>
    );
  }

  const urls = block.content
    .split(/\n|,/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith("http") || entry.startsWith("/"));
  if (urls.length > 0) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
        {urls.map((url) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={url}
            src={url}
            alt=""
            className="w-full aspect-square object-cover rounded-md"
          />
        ))}
      </div>
    );
  }

  return null;
}

export function ContentBlockList({
  blocks,
}: {
  blocks: ContentBlockViewModel[];
}) {
  if (blocks.length === 0) {
    return (
      <EmptyState
        title="Keine Inhaltsblöcke"
        description="Diese Seite hat noch keine Inhaltsblöcke."
      />
    );
  }

  return (
    <div className="grid gap-3.5 mt-4">
      {blocks.map((block) => (
        <article
          key={block.id}
          /* uwe-glass-surface: reiner Theme-Hook für body.uwe-theme-frosted (uwe.css) */
          className="uwe-glass-surface rounded-[0.65rem] border border-border bg-[color-mix(in_srgb,var(--uwe-card)_82%,transparent)] overflow-hidden"
        >
          <header className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-[var(--uwe-border-muted)] bg-[color-mix(in_srgb,var(--uwe-panel)_91%,transparent)]">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {BLOCK_TYPE_LABELS[block.type]}
            </span>
          </header>
          {renderBlockBody(block)}
        </article>
      ))}
    </div>
  );
}

function renderBlockBody(block: ContentBlockViewModel) {
  if (block.type === "image") {
    const src = block.content.trim();
    if (src.startsWith("http") || src.startsWith("/")) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="max-w-full h-auto rounded-md" />
      );
    }
  }

  if (block.type === "gallery") {
    const gallery = renderGalleryBlock(block);
    if (gallery) {
      return gallery;
    }
  }

  return (
    <pre className="m-0 px-3 py-3.5 whitespace-pre-wrap font-[inherit] text-sm leading-relaxed text-foreground">
      {block.content}
    </pre>
  );
}

export function MetaPanel({
  canonicalStatus,
  type,
  tags,
  aliases,
}: {
  canonicalStatus: CanonicalStatus;
  type: PageType;
  tags: string[];
  aliases: string[];
}) {
  const dt = "text-xs uppercase tracking-wider text-muted-foreground mb-1";
  const dd = "m-0 mb-3.5";

  return (
    <div>
      <dl className="m-0">
        <div>
          <dt className={dt}>Typ</dt>
          <dd className={dd}><PageTypeBadge type={type} /></dd>
        </div>
        <div>
          <dt className={dt}>Kanon</dt>
          <dd className={dd}><CanonicalBadge status={canonicalStatus} /></dd>
        </div>
        {tags.length > 0 && (
          <div>
            <dt className={dt}>Tags</dt>
            <dd className={`${dd} flex flex-wrap gap-1.5`}>
              {tags.map((tag) => (
                <TagChip key={tag} tag={tag} />
              ))}
            </dd>
          </div>
        )}
        {aliases.length > 0 && (
          <div>
            <dt className={dt}>Aliase</dt>
            <dd className={dd}>{aliases.join(", ")}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
