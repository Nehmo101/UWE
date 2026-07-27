/**
 * Operations cockpit data: the admin status roll-up and the homelab overview.
 *
 * Both used to live in `apps/studio/src/lib`. The Studio System hub moved to
 * Brain (Abschnitt D1), so the data assembly moved out of the app and into a
 * package — Brain, Studio and the API route now read the same source.
 */
export * from "./admin-status";
export * from "./homelab";
