/**
 * `@uwe/session-runner` — Lesereihenfolge und Lesezeichen für den Spielabend.
 *
 * Rein: keine Datenbank, kein React. Der Runner im Studio setzt das mit
 * `buildPageView` und `SessionLiveEntry` zusammen.
 */

export {
  buildReadingOrder,
  findReadingNeighbours,
  buildAncestorTrail,
  findReadingRoot,
  findChildren,
  type ReadingPage,
  type ReadingEntry,
  type ReadingNeighbours,
} from "./reading-order";

export {
  buildVolume,
  buildVolumeToc,
  countVolumePages,
  findVolumeRoots,
  type BuildVolumeOptions,
  type Volume,
  type VolumeSection,
  type VolumeTocEntry,
} from "./volume";

export {
  MIN_QUERY_LENGTH,
  buildSnippet,
  findMatchRanges,
  highlightHtml,
  matchesQuery,
  normalizeQuery,
  plainTextFromHtml,
  searchSections,
  searchVolume,
  sectionToSearchable,
  type SearchSnippet,
  type SearchableSection,
  type SectionHit,
  type TextRange,
  type VolumeSearchResult,
} from "./volume-search";

export {
  SESSION_BOOKMARK_KIND,
  encodeBookmarkPayload,
  parseBookmarkPayload,
  latestBookmark,
  type SessionBookmark,
  type BookmarkCandidate,
} from "./bookmark";
