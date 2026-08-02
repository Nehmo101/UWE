/**
 * `@uwe/doc-import` — Dokument- und Bulk-Wiki-Import.
 *
 * Dieser Einstiegspunkt ist rein: kein Prisma, kein AI-Router, kein Dateisystem.
 * Alles hier ist eine Funktion von Text auf Daten und damit ohne Datenbank und
 * ohne RTX testbar. Der Schreibpfad liegt bewusst daneben unter
 * `@uwe/doc-import/writer`; die Sanitisierung des erzeugten HTML passiert beim
 * Rendern (`sanitizeWikiHtml`).
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

export {
  buildDocImportPlan,
  DOC_IMPORT_SOURCE_TAG,
  type BuildDocImportPlanOptions,
  type DocImportMode,
  type DocImportPlan,
  type DocImportSourceFile,
  type DocImportStructure,
} from "./plan";

export {
  classifySection,
  describeStructure,
  isEntityRole,
  isListRole,
  isPageRole,
  isPartHeading,
  splitHeadingLabel,
  tidyHeadingText,
  SECTION_ROLE_LABELS,
  type ClassifyContext,
} from "./semantic/roles";

export {
  extractDefinitionBullets,
  extractLabelledBlocks,
  looksLikeCombatStatblock,
  splitStatblockBody,
  wrapDmSection,
  type ExtractedBlock,
  type ExtractBlocksResult,
  type SplitStatblock,
} from "./semantic/blocks";

export {
  collectEntityNodes,
  restructureDocument,
  shiftHeadings,
  type RestructureOptions,
  type RestructureResult,
} from "./semantic/restructure";


export { linkEntityNames, type LinkTarget } from "./semantic/crosslink";

export {
  buildKnownEntityIndex,
  matchKnownEntity,
  selectMentionedEntities,
  type KnownEntity,
  type KnownEntityMatch,
} from "./semantic/world-context";

export {
  AI_ASSIGNABLE_ROLES,
  buildOutlinePrompt,
  parseOutlineHints,
  type OutlinePromptOptions,
} from "./semantic/ai-hints";

export { nodePath, outlineExcerpt, type OutlineEntry } from "./semantic/outline";

export {
  buildDocImportPreview,
  type BuildDocImportPreviewOptions,
  type DocImportItem,
  type DocImportItemStatus,
  type DocImportPreview,
  type ExistingPageRef,
} from "./preview";

export type {
  CanonMarker,
  DocFrontmatter,
  DocProfile,
  DocumentNode,
  DocumentTree,
  PageDraft,
  RelationDraft,
  SectionRole,
} from "./types";
