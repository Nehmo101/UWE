/**
 * Re-export of the framework-agnostic navigation contract.
 *
 * The contract lives in `@uwe/shared-utils` so that Studio, Portal, and the
 * UWE Command Center can consume the same types/helpers without
 * cross-app imports. Studio navigation modules import from `./types`.
 */
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
} from "@uwe/shared-utils/navigation";
