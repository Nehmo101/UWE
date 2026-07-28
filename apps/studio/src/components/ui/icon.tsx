/**
 * Navigations-Icons — liegt seit H10 in `@uwe/shared-ui`.
 *
 * Brain braucht denselben Renderer für das Mail-Center, also ist er in das
 * geteilte Paket gewandert. Dieser Pfad bleibt als Re-Export bestehen: die 13
 * Studio-Importe stimmen weiter, ohne dass sie angefasst werden mussten.
 */
export { NavIcon, resolveLucideIcon, type NavIconProps } from "@uwe/shared-ui";
