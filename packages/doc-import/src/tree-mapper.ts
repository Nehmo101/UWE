/**
 * Vom Überschriftenbaum zu Seitenentwürfen.
 *
 * Hier wird aus Struktur Inhalt: jeder Knoten bekommt Titel, Slug, Typ, Status,
 * Tags und fertiges HTML. Was dieses Modul **nicht** tut: die Datenbank anfassen.
 * Slugs werden nur gegen die mitgegebene Menge geprüft, Kampagnen und
 * `siehe_auch`-Ziele bleiben unaufgelöste Namen. Das Auflösen passiert eine
 * Schicht weiter oben, wo es einen Welt-Index gibt.
 *
 * Eine Beobachtung, die die Baumform bestimmt: Lasses Dokumente haben alle
 * dieselbe Gestalt — eine erste `#`-Überschrift als Dokumenttitel, danach
 * weitere `#`-Überschriften als Teile.
 *
 *     # DER MAGISTER-TURM VON VALIDORI   ← Dokumenttitel
 *     # TEIL A — FÜR DIE SPIELLEITUNG    ← Teil
 *     # TEIL B — DIE WURZELPLATTFORM     ← Teil
 *
 * Deshalb gilt: **der erste Wurzelknoten wird die Wurzelseite, alle weiteren
 * werden seine Kinder.** Für ein Dokument mit nur einer `#`-Überschrift ändert
 * das nichts.
 */

import { pickUniqueSlug, slugifyDe } from "@uwe/shared-utils/slug";
import { markerToCanonicalStatus, resolveCanonicalStatus } from "./canonical-status";
import { markdownToSummary, markdownToWikiHtml } from "./markdown-html";
import { profileDefaultStatus, resolveNodePageType } from "./profiles";
import type {
  DocFrontmatter,
  DocProfile,
  DocumentNode,
  DocumentTree,
  PageDraft,
  RelationDraft,
} from "./types";

const MAX_SLUG_LENGTH = 80;

/** Was mit weiteren `#`-Überschriften neben der ersten passiert. */
export type RootMergeMode = "children" | "body";

export interface MapDocumentOptions {
  profile: DocProfile;
  frontmatter: DocFrontmatter;
  /** Titel, wenn weder Frontmatter noch Überschrift einen liefern (meist der Dateiname). */
  fallbackTitle: string;
  /** Slugs, die in der Zielwelt schon vergeben sind. */
  existingSlugs?: Iterable<string>;
  /** Herkunftsdatei für die Provenienz-Metadaten. */
  sourceFile?: string;
  /** `"body"` erzwingt genau eine Seite — der Weg für den Bulk-Wiki-Import. */
  mergeRoots?: RootMergeMode;
}

export interface MappedDocument {
  pages: PageDraft[];
  relations: RelationDraft[];
  warnings: string[];
}

/** `Turm` → `kampagne/turm`. Die Mehrfachzuordnung einer Seite läuft über Tags. */
export function campaignTag(campaignName: string): string {
  return `kampagne/${slugifyDe(campaignName, { fallback: "unbenannt" })}`;
}

interface SlugAllocator {
  take(title: string, parentSlug: string | null): string;
}

/**
 * Vergibt Slugs, die weltweit eindeutig sind (`@@unique([worldId, slug])`).
 *
 * Kollisionen sind hier die Regel, nicht die Ausnahme: „Auf einen Blick" steht
 * in Himmelsrouten neunmal. Erst wird deshalb der Elternslug vorangestellt —
 * `kapitel-1-der-zaunkoenig-auf-einen-blick` sagt mehr als `auf-einen-blick-7` —
 * und erst wenn auch das kollidiert, zählt `pickUniqueSlug` durch.
 */
function createSlugAllocator(existing: Iterable<string> = []): SlugAllocator {
  const taken = new Set(existing);

  return {
    take(title, parentSlug) {
      const base = slugifyDe(title, { maxLength: MAX_SLUG_LENGTH, fallback: "abschnitt" });

      if (!taken.has(base)) {
        taken.add(base);
        return base;
      }

      if (parentSlug) {
        const qualified = `${parentSlug}-${base}`.slice(0, MAX_SLUG_LENGTH);
        if (qualified && !taken.has(qualified)) {
          taken.add(qualified);
          return qualified;
        }
      }

      const unique = pickUniqueSlug(base, taken, {
        maxLength: MAX_SLUG_LENGTH,
        fallback: "abschnitt",
      });
      taken.add(unique);
      return unique;
    },
  };
}

/** Tiefe Kopie — dieses Modul fasst den übergebenen Baum nicht an. */
function cloneNode(node: DocumentNode): DocumentNode {
  return { ...node, children: node.children.map(cloneNode) };
}

/** Ein Knoten und alles darunter als Markdown, damit nichts verloren geht. */
function nodeToMarkdown(node: DocumentNode, level: number): string {
  const heading = `${"#".repeat(Math.min(6, level))} ${node.title}`;
  const parts = [heading, node.body.trim()].filter(Boolean);

  for (const child of node.children) {
    parts.push(nodeToMarkdown(child, level + 1));
  }

  return parts.join("\n\n");
}

/**
 * Der erste Wurzelknoten trägt das Dokument; alle weiteren werden seine Kinder.
 *
 * Beim Bulk-Wiki-Import gilt „eine Datei = eine Seite" — dort werden die weiteren
 * Wurzeln stattdessen als Markdown in den Rumpf zurückgeschrieben (`mode: "body"`),
 * damit aus einer Personenseite nicht zehn Fragmente werden.
 *
 * Arbeitet auf einer Kopie: derselbe Baum lässt sich mehrfach mit anderen
 * Einstellungen abbilden, ohne dass die erste Abbildung die zweite verfälscht.
 */
function foldRoots(nodes: DocumentNode[], mode: RootMergeMode): DocumentNode | null {
  if (nodes.length === 0) return null;

  const root = cloneNode(nodes[0]);
  const rest = nodes.slice(1);

  if (mode === "body") {
    const own = root.children.map((child) => nodeToMarkdown(child, 2));
    const extra = rest.map((node) => nodeToMarkdown(node, 2));
    const appended = [...own, ...extra].filter(Boolean).join("\n\n");

    root.body = [root.body.trim(), appended].filter(Boolean).join("\n\n");
    root.children = [];
    return root;
  }

  if (rest.length === 0) return root;

  const offset = root.children.length;
  root.children = [
    ...root.children,
    ...rest.map((node, index) => ({ ...cloneNode(node), sortIndex: offset + index })),
  ];

  return root;
}

function statusFor(
  node: DocumentNode,
  frontmatter: DocFrontmatter,
  profile: DocProfile,
): PageDraft["canonicalStatus"] {
  if (node.marker) return markerToCanonicalStatus(node.marker);

  const declared = resolveCanonicalStatus(frontmatter.status);
  if (declared) return declared;

  return profileDefaultStatus(profile);
}

export function mapDocumentTree(
  tree: DocumentTree,
  options: MapDocumentOptions,
): MappedDocument {
  const { profile, frontmatter, fallbackTitle, sourceFile } = options;
  const warnings: string[] = [];
  const pages: PageDraft[] = [];
  const relations: RelationDraft[] = [];
  const slugs = createSlugAllocator(options.existingSlugs);

  const root = foldRoots(tree.nodes, options.mergeRoots ?? "children");

  if (!root) {
    // Ein Dokument ganz ohne Überschrift ist trotzdem eine Seite.
    const title = frontmatter.title?.trim() || fallbackTitle;
    const body = tree.preamble;
    const slug = frontmatter.slug?.trim() || slugs.take(title, null);

    pages.push(
      buildDraft({
        key: "node-0",
        parentKey: null,
        sortIndex: null,
        title,
        slug,
        node: { level: 1, title, body, marker: null, sortIndex: 0, children: [] },
        isRoot: true,
        path: [title],
        profile,
        frontmatter,
        sourceFile,
      }),
    );

    collectRootRelations(relations, "node-0", frontmatter);
    return { pages, relations, warnings };
  }

  if (frontmatter.title?.trim() && frontmatter.title.trim() !== root.title) {
    warnings.push(
      `Frontmatter-Titel „${frontmatter.title.trim()}" weicht von der ersten Überschrift „${root.title}" ab — der Frontmatter-Titel gewinnt.`,
    );
    root.title = frontmatter.title.trim();
  }

  // Vorspann (Untertitel, Anreißer vor der ersten Überschrift) gehört zur Wurzel.
  if (tree.preamble) {
    root.body = root.body ? `${tree.preamble}\n\n${root.body}` : tree.preamble;
  }

  let counter = 0;

  const walk = (
    node: DocumentNode,
    parentKey: string | null,
    parentSlug: string | null,
    path: string[],
  ) => {
    const key = `node-${counter++}`;
    const isRoot = parentKey === null;
    const slug =
      isRoot && frontmatter.slug?.trim()
        ? frontmatter.slug.trim()
        : slugs.take(node.title, parentSlug);
    const nextPath = [...path, node.title];

    pages.push(
      buildDraft({
        key,
        parentKey,
        sortIndex: isRoot ? null : node.sortIndex,
        title: node.title,
        slug,
        node,
        isRoot,
        path: nextPath,
        profile,
        frontmatter,
        sourceFile,
      }),
    );

    if (isRoot) collectRootRelations(relations, key, frontmatter);

    for (const child of node.children) {
      walk(child, key, slug, nextPath);
    }
  };

  walk(root, null, null, []);

  return { pages, relations, warnings };
}

function collectRootRelations(
  relations: RelationDraft[],
  sourceKey: string,
  frontmatter: DocFrontmatter,
): void {
  for (const target of frontmatter.seeAlso) {
    relations.push({
      sourceKey,
      targetLookup: target,
      relationType: "related",
      label: null,
    });
  }
}

interface BuildDraftInput {
  key: string;
  parentKey: string | null;
  sortIndex: number | null;
  title: string;
  slug: string;
  node: DocumentNode;
  isRoot: boolean;
  path: string[];
  profile: DocProfile;
  frontmatter: DocFrontmatter;
  sourceFile?: string;
}

function buildDraft(input: BuildDraftInput): PageDraft {
  const { node, frontmatter, isRoot, profile } = input;

  const type = resolveNodePageType(node, {
    profile,
    isRoot,
    // Ein `typ:` im Frontmatter beschreibt das Dokument, nicht jeden Abschnitt darin.
    declaredType: isRoot ? frontmatter.type : undefined,
  });

  const tags = isRoot
    ? [...frontmatter.tags, ...frontmatter.campaigns.map(campaignTag)]
    : frontmatter.campaigns.map(campaignTag);

  const metadata: Record<string, unknown> = {
    source: "doc-import",
    profile,
    headingLevel: node.level,
    docPath: input.path,
    ...(input.sourceFile ? { sourceFile: input.sourceFile } : {}),
    ...(node.marker ? { canonMarker: node.marker } : {}),
  };

  if (isRoot && Object.keys(frontmatter.extra).length > 0) {
    metadata.frontmatter = { ...frontmatter.extra };
  }
  if (isRoot && frontmatter.sources.length > 0) {
    metadata.sources = [...frontmatter.sources];
  }

  return {
    key: input.key,
    parentKey: input.parentKey,
    sortIndex: input.sortIndex,
    title: input.title,
    slug: input.slug,
    type,
    summary: (isRoot ? frontmatter.summary : undefined) ?? markdownToSummary(node.body),
    canonicalStatus: statusFor(node, frontmatter, profile),
    tags: dedupe(tags),
    aliases: isRoot ? dedupe(frontmatter.aliases) : [],
    html: markdownToWikiHtml(node.body),
    campaigns: [...frontmatter.campaigns],
    seeAlso: isRoot ? [...frontmatter.seeAlso] : [],
    metadata,
    warnings: [],
  };
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLocaleLowerCase("de");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }

  return out;
}
