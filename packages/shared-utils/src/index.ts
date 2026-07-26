/**
 * UWE shared, framework-agnostic utilities.
 */

export {
  slugifyDe,
  slugifyAscii,
  slugifyKey,
  pickUniqueSlug,
  normalizeLookupKey,
  type SlugifyOptions,
} from "./slug";

export {
  normalizeNavPath,
  isNavItemActive,
  flattenNavGroups,
  resolveNavGroups,
  navGroupsToCommands,
  findNavConflicts,
  type NavStatus,
  type NavPermission,
  type NavSource,
  type NavItem,
  type NavGroup,
  type ResolvedNavItem,
  type ResolvedNavGroup,
  type NavCommand,
  type NavConflicts,
} from "./navigation";

export {
  normalizeSearchText,
  navSearchTokens,
  searchNavEntries,
  dedupeNavSearchEntries,
  type NavSearchEntry,
  type NavSearchHit,
  type NavSearchOptions,
} from "./nav-search";
