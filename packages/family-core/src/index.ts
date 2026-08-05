/**
 * `@uwe/family-core` — Haushalts-Domäne von UWE Family.
 *
 * Hier liegt, was Family über die reine Datenhaltung hinaus ausmacht:
 * Mitglieder (mit und ohne Konto), personenbezogener Kalender, Geburtstage
 * und Jahrestage, Gesundheits-/Tierarzt-Akte, ICS-Feed und Wochenbriefing.
 *
 * `@uwe/database` bleibt Datenzugriff; neue Domänen-Services gehören hierher.
 */
export * from "./family-types";
export * from "./member-colours";
export * from "./anniversaries";
export * from "./member-service";
export * from "./event-members";
export * from "./event-duration";
export * from "./subscription-service";
export * from "./ics-feed";
export * from "./health-service";
export * from "./briefing-service";
export * from "./briefing-loader";
export * from "./day-brief-service";
