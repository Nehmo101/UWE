/**
 * Daily Admin OS cockpit — die Datenbeschaffung der „Heute"-Seite.
 *
 * Lag in `apps/studio/src/lib`. Die Seite selbst ist nach Brain gewandert
 * (Abschnitt H1), also gehört die Aggregation in ein Package statt in eine App.
 *
 * Namentliche Re-Exports, kein `export *`: derselbe CJS-Lexer-Grund wie bei
 * `@uwe/host-cockpit`.
 */
export {
  getTodayDashboardData,
  resolvePreferredWorldSlug,
  type TodayDashboardData,
  type TodayMailSummary,
} from "./today-dashboard";
