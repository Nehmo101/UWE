/**
 * UWE Family tool catalog — der gemeinsame Haushalts-Bereich.
 *
 * Family serviert seine Inhalte seit der externen API selbst (`/api/v1/*`),
 * `dataApi` zeigt deshalb auf denselben Origin wie `primary` — anders als bei
 * Portal und Brain, die über Studio lesen.
 *
 * Zwei Dinge unterscheiden diesen Katalog von den anderen:
 *
 *  - **Kein Welt-Begriff.** Family kennt keine Welten und keine Rollen. Wer das
 *    Häkchen `Family` trägt, sieht alles; ein API-Token braucht `family_read`
 *    beziehungsweise `family_write`.
 *  - **Der Haushalt ist geteilt, aber nicht öffentlich.** Was hier
 *    herauskommt — Termine, Einkaufsliste, Gesundheitsakte — betrifft
 *    Angehörige, auch Kinder. Die Tools geben deshalb keine privaten Chats und
 *    keine Dokumente heraus; dafür gibt es bewusst keinen Endpunkt.
 */
import type { ToolDefinition } from "../protocol/types";
import { booleanArg, httpTool, numberArg, objectSchema, stringArg, type ToolContext } from "./context";

function readTools(context: ToolContext): ToolDefinition[] {
  return [
    httpTool(context, {
      name: "family_health",
      title: "Family Health",
      description:
        "Liveness der Family-App. Bewusst minimal — verrät nichts über den Haushalt.",
      client: "primary",
      inputSchema: objectSchema({}),
      path: () => "/api/health",
    }),

    httpTool(context, {
      name: "family_members",
      title: "Mitglieder",
      description:
        "Wer zum Haushalt gehört: Name, Art (Erwachsen, Kind, Haustier, Gast), Farbe, Geburtstag. Mitglieder ohne Konto sind eingeschlossen — ein Kleinkind oder eine Katze hat kein Login, gehört aber dazu.",
      inputSchema: objectSchema({
        includeInactive: booleanArg("Auch deaktivierte Mitglieder mitliefern (Default false)."),
      }),
      path: () => "/api/v1/members",
      query: (args) => ({
        includeInactive: args["includeInactive"] === true ? "true" : undefined,
      }),
    }),

    httpTool(context, {
      name: "family_calendar_upcoming",
      title: "Anstehende Termine",
      description:
        "Termine des Haushalts in einem Zeitraum, mit den beteiligten Personen. Ohne Angabe die kommenden 30 Tage. `memberId` filtert auf eine Person, `includeAnniversaries` nimmt Geburtstage und Jahrestage mit.",
      inputSchema: objectSchema({
        from: stringArg("Beginn als ISO-Datum (Default: jetzt)."),
        to: stringArg("Ende als ISO-Datum (Default: in 30 Tagen)."),
        memberId: stringArg("Nur Termine dieser Person (ID aus family_members)."),
        includeAnniversaries: booleanArg("Geburtstage und Jahrestage mitliefern."),
        limit: numberArg("Höchstzahl Termine (Default 100, max 500)."),
      }),
      path: () => "/api/v1/calendar/events",
      query: (args) => ({
        from: typeof args["from"] === "string" ? args["from"] : undefined,
        to: typeof args["to"] === "string" ? args["to"] : undefined,
        memberId: typeof args["memberId"] === "string" ? args["memberId"] : undefined,
        includeAnniversaries: args["includeAnniversaries"] === true ? "true" : undefined,
        limit: typeof args["limit"] === "number" ? args["limit"] : undefined,
      }),
    }),

    httpTool(context, {
      name: "family_shopping_list",
      title: "Einkaufsliste",
      description:
        "Ohne `listId` die Übersicht der Einkaufslisten, mit `listId` deren Positionen. Zwei Schritte, damit ein Blick auf die Listen nicht die ganze Historie zieht.",
      inputSchema: objectSchema({
        listId: stringArg("Kennung einer Liste; leer lassen für die Übersicht."),
      }),
      path: () => "/api/v1/shopping/items",
      query: (args) => ({
        listId: typeof args["listId"] === "string" ? args["listId"] : undefined,
      }),
    }),

    httpTool(context, {
      name: "family_recipes",
      title: "Rezepte",
      description:
        "Rezepte des Haushalts mit Titel, Dauer, Portionen und Bewertung. Gepflegt werden sie in der Küche; dieses Tool liest nur.",
      inputSchema: objectSchema({
        tag: stringArg("Nur Rezepte mit diesem Tag."),
      }),
      path: () => "/api/v1/recipes",
      query: (args) => ({
        tag: typeof args["tag"] === "string" ? args["tag"] : undefined,
      }),
    }),

    httpTool(context, {
      name: "family_day_brief",
      title: "Tagesstand",
      description:
        "Was heute (und optional morgen) im Haushalt ansteht, in einem Aufruf: Termine je Person, Geburtstage, Essensplan, offene Einkaufsliste, fällige Wartungsaufgaben und Gesundheits-Fälligkeiten. Für den schnellen Überblick gedacht — Einzelheiten holen die spezialisierten Tools.",
      inputSchema: objectSchema({
        days: numberArg("1 = nur heute, 2 = heute und morgen (Default 2)."),
        at: stringArg("Bezugszeitpunkt als ISO-Zeitstempel (Default: jetzt)."),
      }),
      path: () => "/api/v1/day-brief",
      query: (args) => ({
        days: typeof args["days"] === "number" ? args["days"] : undefined,
        at: typeof args["at"] === "string" ? args["at"] : undefined,
      }),
    }),

    httpTool(context, {
      name: "family_health_due",
      title: "Gesundheit — Fälligkeiten",
      description:
        "Was in der Gesundheits- und Tierarzt-Akte demnächst fällig wird (Impfungen, Vorsorge, Medikamente) — für Menschen und Tiere. Mit `memberId` stattdessen die ganze Akte einer Person.",
      inputSchema: objectSchema({
        memberId: stringArg("Ganze Akte dieser Person statt der Fälligkeiten."),
      }),
      path: () => "/api/v1/health",
      query: (args) => ({
        memberId: typeof args["memberId"] === "string" ? args["memberId"] : undefined,
      }),
    }),
  ];
}

function writeTools(context: ToolContext): ToolDefinition[] {
  return [
    httpTool(context, {
      name: "family_calendar_add_event",
      title: "Termin anlegen",
      description:
        "Legt einen Termin im Haushalts-Kalender an. `memberIds` bestimmt, wen er betrifft; ohne Angabe gilt er für den ganzen Haushalt.",
      method: "POST",
      inputSchema: objectSchema(
        {
          title: stringArg("Titel des Termins."),
          startAt: stringArg("Beginn als ISO-Zeitstempel."),
          endAt: stringArg(
            "Ende als ISO-Zeitstempel (optional). Ohne Angabe dauert der Termin eine Stunde; ganztägig bleibt ohne Ende.",
          ),
          allDay: booleanArg("Ganztägig (Default false)."),
          location: stringArg("Ort (optional)."),
          description: stringArg("Notiz (optional)."),
          memberIds: {
            type: "array",
            description: "Kennungen der beteiligten Personen (aus family_members).",
            items: { type: "string" },
          },
        },
        ["title", "startAt"],
      ),
      path: () => "/api/v1/calendar/events",
      body: (args) => args,
      annotations: { readOnlyHint: false },
    }),

    httpTool(context, {
      name: "family_shopping_add",
      title: "Einkauf ergänzen",
      description:
        "Setzt eine Position auf die Einkaufsliste. Ohne `listId` landet sie auf der zuletzt angelegten offenen Liste.",
      method: "POST",
      inputSchema: objectSchema(
        {
          name: stringArg("Was gekauft werden soll."),
          amount: numberArg("Menge (optional)."),
          unit: stringArg("Einheit als freier Text, etwa Packung oder Dose (optional)."),
          listId: stringArg("Zielliste; leer lassen für die aktuelle offene Liste."),
        },
        ["name"],
      ),
      path: () => "/api/v1/shopping/items",
      body: (args) => args,
      annotations: { readOnlyHint: false },
    }),
  ];
}

export function createFamilyTools(context: ToolContext): ToolDefinition[] {
  const tools = readTools(context);

  // Schreibende Tools nur mit ausdrücklicher Freigabe — wie bei Studio.
  if (context.config.allowWrites) {
    tools.push(...writeTools(context));
  }

  return tools;
}

export const FAMILY_INSTRUCTIONS = [
  "UWE Family ist der gemeinsame Haushalts-Bereich: Kalender, Mitglieder, Einkauf, Rezepte, Gesundheitsakte.",
  "Es gibt keine Welten und keine Rollen — wer das Häkchen `Family` trägt, sieht alles; ein API-Token braucht family_read bzw. family_write.",
  "Mitglieder können ohne Konto existieren (Kleinkind, Gast, Haustier). Termine gehören keiner, einer oder mehreren Personen; ohne Zuordnung betreffen sie den ganzen Haushalt.",
  "Private Chats und Dokumente gibt dieser Server bewusst nicht heraus. Fehlen family_calendar_add_event oder family_shopping_add, ist UWE_MCP_ALLOW_WRITES nicht gesetzt — darauf hinweisen, statt Umwege zu suchen.",
].join(" ");
