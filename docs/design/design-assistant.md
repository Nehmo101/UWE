# Plan: Konversationeller Design-Assistent (RTX-LLM → Custom-Theme)

## Kontext / Ziel

Heute sind Themes ein fest verdrahtetes Set von 10 Presets (`ThemeId`-Union in
`packages/shared-ui/src/theme/themes.ts`). Ein neues Design anzulegen heißt aktuell:
Code editieren, Tests anpassen, PR (genau das war Parchment Teal, #692/#727).

Ziel: **In UWE selbst** per Chat mit dem lokalen RTX-Client (LLM) ein neues Design
„super easy" anlegen — der Assistent stellt Rückfragen, zeigt Farbvarianten als
Vorschau, und auf „Ja" wird daraus ein **auswählbares Design für Studio oder
Portal** — ohne Code, ohne Deploy. Passt zum Leitprinzip „Self-Service-Betrieb:
jede Konfiguration in UWE einstellbar".

Entscheidungen (bestätigt):
- **Vorschau = Swatch/Live** (kein GPU-Bildbackend; LLM liefert Paletten-JSON,
  UWE rendert Vorschaukarten und wendet live an).
- **Sichtbarkeit = installationsweit** (Speicher in `system_settings`, keine
  DB-Migration).

## UX-Flow (der Fragebogen)

Neuer Einstieg im Studio unter **Einstellungen → Design & Theme** (`appearance`-Tab):
Button „Neues Design mit KI erstellen" → Wizard-Dialog.

1. **Start:** Nutzer wählt Ziel-Scope (Studio / Portal / beide) + eine kurze
   Absicht („dunkles Dracheneis, kühl, ruhig").
2. **Rückfragen (mehrstufig):** Der LLM stellt 2–4 gezielte Fragen (Hell/Dunkel,
   Grundstimmung/Akzentfarbe, Serifen ja/nein, Kontrastvorliebe). Jede Antwort
   fließt in den nächsten Turn.
3. **Varianten:** Der LLM liefert **3 Paletten-Kandidaten als striktes JSON**
   (`ThemeColorTokens`). UWE rendert je Kandidat eine **Vorschaukarte** (Sidebar,
   Card, Primary/Ghost-Button, Wiki-Link, „Portal sichtbar"/„Nur GM"-Badges) und
   erlaubt **Live-Vorschau** (temporäres Anwenden auf die echte Shell).
4. **Iteration:** „mach Variante 2 wärmer / mehr Kontrast" → neuer Turn, neue
   Varianten, bis der Nutzer **eine wählt und bestätigt** („Ja").
5. **Speichern:** Name + Scope → Persistenz in `customThemes`. Danach erscheint das
   Design **sofort im Theme-Picker** (Studio- und/oder Portal-Design) neben den
   Built-ins und ist per Klick aktivierbar.

Barrierefreiheit: vor dem Speichern läuft die vorhandene Kontrastprüfung
(`resolveThemeColorTokens` + `deriveOnAccent`/`deriveLink` + `hexContrast`); AA-
Verstöße werden markiert und der LLM zum Nachbessern aufgefordert (auto-repair).

## Architektur & Datenfluss

```
Studio Wizard (React, apps/studio/components/DesignAssistant/*)
   │  jeder Turn: gesamte Konversation + letzte Antwort
   ▼
Server Action  apps/studio/app/custom-theme-actions.ts
   │  (a) LLM-Turn         (b) Speichern
   ▼                          ▼
@uwe/ai-brain/theme-generator   @uwe/database (custom-theme-preferences.ts)
   │  executeAiGatewayRequest       → repo.updateSystemSettings(customThemes)
   │  contextMode:"general_chat"
   │  providerMode:"local_rtx"|"auto"
   ▼
Router → tryConnectorLlmGenerate → RTX-Host (llm_generate Job)  → Text
   │
   ▼
@uwe/theme-studio (framework-agnostisch):
   parsePaletteJson() + validatePalette() (Hex/Token-Shape + Kontrast-Gate)
   ▼
zurück an Wizard → Swatch-Vorschau (SVG/CSS-vars) + Live-Apply (applyColorTokens)
```

Wichtige Fakten aus der Recherche:
- **Kein Multi-Turn-API:** Jede Anfrage ist ein einzelnes `{system,user}`-Paar.
  → Wir **serialisieren die Historie selbst** in `userPrompt` (kompakter
  Transcript-Block + strikte JSON-Ausgabeanweisung). Kein Server-Session-Store nötig.
- **Kein JSON-Schema/Tool-Calling:** Struktur nur per Prompt-Konvention + `JSON.parse`
  (wie `simulate_faction` / `generate_structured_*` in `ai-brain/src/tasks.ts`).
  → Eigener Parser + Zod-Validierung + Retry-on-invalid-JSON.
- **Privacy-Guards greifen nicht:** Design-Chat ist generischer Inhalt ohne
  Kampagnen-/Brain-Kontext → `general_chat` + `local_rtx`/`auto` ist konform.
- **Bilder = Stub:** `image_generate` liefert ohne `UWE_IMAGE_BACKEND_URL` nur ein
  1×1-PNG. → Bewusst **nicht** genutzt; Farbvarianten werden gerendert, nicht gemalt.

## Datenmodell (keine Migration)

Neue JSON-Untergruppe im bestehenden `SystemSettings.settings` (Singleton-Row
`id="default"`), analog zu `themePreferences`:

```ts
// AppSettings (packages/database/src/settings-service.ts)
customThemes?: CustomThemeRecord[]

interface CustomThemeRecord {
  id: string;            // z.B. "custom-<slug>-<kurzid>", stabil
  label: string;
  description?: string;
  scope: "studio" | "portal" | "both";
  colors: ThemeColorTokens;      // die 25 Kern-Tokens (Hex), tokens.ts
  defaults?: { font?; density?; background?; frostedGlass?; bgEffect… };
  createdAt: string;
}
```

- Neuer Normalizer `packages/database/src/custom-theme-preferences.ts`
  (spiegelt `theme-preferences.ts`): validiert jeden Record + jeden Hex-Wert,
  Subpath-Export in `packages/database/package.json` (**nicht** in `server.ts`-Barrel).
- In `mergeSettings`/`normalizeSettings` einhängen; Allow-List in
  `settings-validation.ts` (`APP_KEYS` + Gruppen-Validator) ergänzen.
- Ausgewähltes Design bleibt wie bisher in `themePreferences.{studio,portal}.themeId`
  — verweist nun ggf. auf eine `customThemes`-`id`.

## Tragender Umbau: Theme-Registry „geschlossen → offen"

Die Persistenz ist trivial; die eigentliche Arbeit ist, dass ein Custom-`themeId`
nicht mehr auf einen Fallback zurückgeschrieben wird. Betroffen (genau diese Stellen):

1. `packages/shared-ui/src/theme/themes.ts`
   - `getTheme(id)` → optional zusätzlich in einer **Laufzeit-Registry** nachschlagen
     (nicht nur `UWE_THEMES`); `undefined`-Fall absichern (sonst Crash bei `.colors`).
   - `isThemeId` / `resolveThemeId` → bekannte Custom-IDs akzeptieren statt zu ersetzen.
   - Mechanismus: `setCustomThemes(records)` füllt eine Modul-`Map`; `ThemeId` wird zu
     `string` geweitet (die 10 Literale bleiben als Vorschläge/Union-Member erhalten).
2. Load-Pfade, die heute sanitisieren: `parsePreferences` (`storage.ts`) und
   `toUweThemePreferences`/`resolveThemeId` (`sync.ts`) müssen die verfügbaren
   Custom-IDs kennen.
3. Anti-Flash-Bootstrap `bootstrapScript.ts`: das gebackene `MAP` ist Build-Zeit-only.
   Aktive Custom-Palette zur **Request-Zeit** via bestehende `serverPreferences`-
   Option (bzw. serialisierte `customThemes`) injizieren, sonst blitzt beim ersten
   Paint der Fallback.
4. Picker `ThemeScopeSettingsPanel.tsx`: `THEME_LIST` → `[...THEME_LIST,
   ...customThemesForScope]`. `Swatch` nimmt bereits ein rohes `colors`-Objekt → fertig.

**Chrome-Grenze (bewusst):** Custom-Themes bekommen die generische, token-getriebene
Chrome (wie `uwe-default`/`terra`) — **nicht** den Parchment-Spezial-CSS-Block
(Ink-Sidebar/Serifen), der an feste IDs gebunden ist. Falls gewünscht, kann der
Assistent Chrome-Feintuning über den vorhandenen `ElementOverrideTokens`-Layer
(`--uwe-zone-*`) anbieten — ohne neues CSS.

## Package-Platzierung (Anti-Monolith-Regeln)

| Concern | Ort |
|---|---|
| LLM-Konversation (Prompt-Bau, Turn-Runner) | **`@uwe/ai-brain/theme-generator`** (neuer Subpath, Geschwister von `dnd-generator/`) |
| Paletten-Domänenlogik (JSON-Parse, Validierung, Kontrast-Gate, Auto-Repair) | **neues `packages/theme-studio`** (framework-agnostisch; genutzt von ai-brain + shared-ui) |
| Speicher-Normalizer für `customThemes` | **`@uwe/database/custom-theme-preferences`** (Subpath, nicht Barrel) |
| Registry-Merge + Live-Apply + Picker | **`@uwe/shared-ui/theme`** (besitzt die Render-Pipeline) |
| Wizard-UI + Server Action + Einstieg | **`apps/studio`** (`components/DesignAssistant/*`, `app/custom-theme-actions.ts`, Einstieg im `appearance`-Tab) |

Kein Host-Sync (reine App-Daten). Keine Business-Logik in Route Handlern. Neue
Dateien ≤700 Zeilen; `server.ts`-Barrel unangetastet.

## Cookbook: Modell-Empfehlung für Design-Aufgaben (`@uwe/cookbook`)

Der RTX-Client zeigt bereits hardware-bewusste Modellvorschläge **pro Use-Case**
(`CookbookPanel` → `computeModelFit`). Für den Design-Assistenten kommt ein neuer
Use-Case dazu, damit der Client zeigt „dieses LLM ist für Design-Erstellung sinnvoll":

1. `packages/cookbook/src/types.ts` — `CookbookUseCaseId` um `"theme_design"` ergänzen.
2. `packages/cookbook/src/model-registry.ts` — Use-Case-Metadaten (Label/Beschreibung)
   + geeignete Modelle mit `useCases: [..., "theme_design"]` taggen.
3. `packages/cookbook/src/model-fit.ts` — die beiden per-Use-Case-Konstanten setzen
   (min. Kontextlänge + Score-Gewicht).
4. `packages/cookbook/src/routing-hints.ts` — `TASK_TO_USE_CASE` erweitert den neuen
   Design-`AiTaskType` → `"theme_design"`. Kein UI-Umbau nötig; das Panel liest die
   Registry.

**Auswahlkriterium (wichtig, unterscheidet sich von `dnd_generator`):** Hier zählt
**striktes Instruction-Following + zuverlässiges JSON**, nicht kreative Prosa. Also
Modelle mit starkem strukturiertem Output + gutem Deutsch bevorzugen (Qwen-2.5-Familie
7B/14B/32B; Llama-3.1-8B als schlanke Basis). Sehr kleine/instruction-schwache Modelle
ausschließen — ungültiges JSON bricht den Flow. Die Hardware-Fit-Bewertung des Cookbooks
(„passt auf die GPU") greift automatisch obendrauf. Gehört in **Phase 2** (LLM-Task).

## Implementierungs-Phasen

- **Phase 0 — Registry offen machen (Fundament).** `themes.ts` Laufzeit-Registry +
  `customThemes`-Speicher + Picker liest Custom + Bootstrap-Injektion. Test:
  ein manuell in `system_settings` gelegtes Custom-Theme ist auswählbar & wird
  angewendet (ohne LLM). Tests in `theme.test.ts` etc. auf offene Registry anpassen.
- **Phase 1 — Paletten-Domäne (`packages/theme-studio`).** `ThemeColorTokens`-JSON-
  Schema (Zod), `validatePalette` (Shape + AA-Kontrast via vorhandene Derivations-
  Utils), `repairPrompt`-Hinweise. Unit-Tests.
- **Phase 2 — LLM-Task (`ai-brain/theme-generator`).** System/Task-Prompt (DE,
  du-Form), Historien-Serialisierung, Aufruf `executeAiGatewayRequest` (general_chat,
  local_rtx/auto), JSON-Parse + Retry. Neuer `AiTaskType`/`feature`-Wert; Mock-Modus
  für Tests (`useMock`).
- **Phase 3 — Wizard-UI (Studio).** Chat-Dialog, 3-Varianten-Vorschaukarten,
  Live-Apply-Toggle, Speichern-Formular (Name/Scope). Server Action
  `custom-theme-actions.ts`.
- **Phase 4 — Politur.** Löschen/Umbenennen von Custom-Themes im Picker,
  optional Export/Import als JSON (im Migrationsdoc als „next step" gelistet),
  optional `ElementOverride`-Feintuning.

Sinnvoll als **mehrere kleine PRs** (Phase 0 zuerst, eigenständig wertvoll: es
ermöglicht Custom-Themes auch ohne KI).

## Risiken & offene Punkte

- **Registry-Injektion ist die heikelste Änderung** (berührt SSR-Bootstrap +
  Load-Sanitizing). Gründlich testen: kein Flash, kein Fallback-Rewrite, kein
  `getTheme(undefined)`-Crash.
- **RTX offline / kein LLM-Connector:** Assistent muss sauber degradieren
  (`isConnectorLlmAvailable` prüfen; Hinweis „RTX offline", manueller Fallback-
  Editor bleibt nutzbar). Custom-Themes aus Phase 0 funktionieren unabhängig vom LLM.
- **LLM liefert ungültiges JSON:** Retry-Schleife + strenge Validierung; nach N
  Versuchen klare Fehlermeldung.
- **Namenskollision** von Custom-IDs mit Built-ins vermeiden (Präfix `custom-`).
- **Portal-Sicherheit:** Custom-Themes sind reine Präsentation (Farb-Tokens) — kein
  Inhalt; `dm_only`-Sichtbarkeitsregeln bleiben unberührt.

## Verifikation

- Phase 0: manuell gesetztes Custom-Theme erscheint im Studio- **und** Portal-Picker
  (je nach Scope), wird angewendet, übersteht Reload ohne Flash (Bootstrap-Check),
  Sync Client↔Server round-trips die Custom-ID ohne Rewrite.
- Phase 1: `pnpm test` für `theme-studio` (Kontrast-Gate lehnt AA-Verstöße ab).
- Phase 2: Mock-LLM-Lauf erzeugt valide Palette; echter RTX-Lauf (falls Connector
  online) via `getInferenceStatus`/`runInferenceTestPrompt` vorab geprüft.
- Phase 3: End-to-End im echten Studio (Wizard → Varianten → Speichern → Auswahl),
  visuell per Screenshot der Vorschaukarten + der angewendeten Shell.
- Quality-Gate `pnpm ci:light`; Kontrast-Iteration der bestehenden
  `resolveColorTokens.test.ts`-Logik wiederverwenden.
