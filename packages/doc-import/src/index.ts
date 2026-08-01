/**
 * `@uwe/doc-import` — reine Helfer für den Dokument- und Bulk-Wiki-Import.
 *
 * Kein Prisma, kein AI-Router, keine Dateisystem-Zugriffe: alles hier ist eine
 * Funktion von Text auf Daten und damit ohne Datenbank und ohne RTX testbar.
 * Persistenz, Kampagnen-Auflösung und Sanitisierung liegen eine Schicht höher.
 */

export {
  splitFrontmatter,
  parseFrontmatterLines,
  normalizeFrontmatterKey,
  asList,
  asScalar,
  type FrontmatterValue,
  type ParsedFrontmatter,
} from "./frontmatter";

export {
  applyDialect,
  parseDocument,
  frontmatterWarnings,
  knownFrontmatterKeys,
  resolveFrontmatterKey,
  type ParsedDocument,
} from "./dialect";

export {
  resolveCanonicalStatus,
  markerToCanonicalStatus,
  stripCanonMarkers,
  detectCanonMarker,
  type StrippedTitle,
} from "./canonical-status";

export { markdownToWikiHtml, markdownToSummary } from "./markdown-html";

export {
  buildDocumentTree,
  normalizeBodyHeadings,
  flattenTree,
  countNodes,
  type BuildDocumentTreeOptions,
} from "./doc-tree";

export {
  resolveNodePageType,
  profileDefaultStatus,
  DOC_PROFILES,
  DOC_PROFILE_LABELS,
  DOC_PROFILE_HINTS,
  type ResolveNodeTypeContext,
} from "./profiles";

export {
  mapDocumentTree,
  campaignTag,
  type MapDocumentOptions,
  type MappedDocument,
  type RootMergeMode,
} from "./tree-mapper";

export { collectWikiLinkTargets, auditWikiLinks, type LinkAudit } from "./relations";

export type {
  CanonMarker,
  DocFrontmatter,
  DocProfile,
  DocumentNode,
  DocumentTree,
  PageDraft,
  RelationDraft,
} from "./types";
