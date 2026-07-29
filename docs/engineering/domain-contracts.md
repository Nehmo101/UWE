# O02 — Zentrale Domain-Boundary-Contracts

Stand: 2026-07-15, Modell-Mapping aktualisiert 2026-07-22 auf das
Atlas-3D-Delta (Detail-Doku `07-delta-und-mehrfachzuordnung.md` wurde mit dem
`rework/`-Baum entfernt).
Dieses Dokument ist eine implementierungsreife Spezifikation,
aber noch keine Implementierung, Migration oder Änderung der aktiven Runtime.
Maßgebliche Quellen sind das Inventar aus Commit
`223ac6f176458bf17a6679e39c066ca6e9721012`, `SECURITY.md`, das Prisma-Schema
und, soweit als Advisory verfügbar, das O01-Decision-Pack aus Commit
`d2eff71a8ebef5518f1916180e980304826e9339`.

## 1. Contract-Wertelisten

### 1.1 `AppAudience`

| Wert | Präzise Semantik |
|---|---|
| `portal` | Request, Session oder Prozess auf der player-facing Surface. Darf ausschließlich serverseitig gefilterte D&D-Projektionen sowie explizit erlaubte Spieleraktionen nutzen. Eine privilegierte Rolle erweitert die Portal-Projektion nicht. |
| `studio` | Authentisierte D&D-/DM-Surface für Welt-Authoring, D&D-Brain, Review, Apply und Publish. Begründet keinen Zugriff auf persönliche Brain- oder Daily-Admin-Daten. |
| `brain` | Owner-only Surface für Personal Brain und Daily Admin OS. Muss zusätzlich zur Audience die Rolle `owner` und das lokale beziehungsweise explizit freigegebene LAN-Exposure prüfen. |
| `platform` | Auth-, Security-, Konfigurations-, Queue-, Connector- und Betriebssurface. Ist keine Superuser-Audience für Fachdaten; Produktdaten dürfen nur über schmale Ports oder opaque Handles orchestriert werden. |

`AppAudience` klassifiziert den beabsichtigten Verbraucher, nicht den heutigen
Hosting-Prozess. Eine Platform-Route, die vorübergehend unter `apps/studio`
liegt, hat deshalb `audience: "platform"`.

### 1.2 `DataDomain`

| Wert | Datenhoheit und Inhalt |
|---|---|
| `dnd_world` | Autoritative Welten, Kampagnen, Seiten, Sessions, Graphen, Atlas, Review und D&D-Authoring. Portal erhält nur abgeleitete Projektionen. |
| `dnd_brain` | Weltgebundene D&D-Dokumente, Chunks, Fakten und KI-Review-Artefakte. Gehört zu Studio, nicht zum persönlichen Brain-Produkt. |
| `portal_player` | Spielerbezogene Entitlements und eng begrenzte Interaktionen, etwa Notizen, Fragen, Verfügbarkeiten, Charaktere und Gruppenschatz. |
| `personal_brain` | Persönliche Dokumente, Chunks, Fakten und persönliche Research-Artefakte. Hart owner-only und local-only. |
| `admin_life` | Daily Admin OS: Mail, Kalender, Capture, Projekte, Werkstatt, Verträge, Hardware, Dokumente, Haushalt, Küche und private Dateien. |
| `platform_auth` | Identität, Session, 2FA, Weltmitgliedschaft und API-Zugriffsverwaltung. Keine fachlichen Produktinhalte. |
| `platform_ops` | Instanzkonfiguration, Security-/Betriebsaudit, Seeds, Entwicklungsvorgänge und produktgetrennte Taxonomie. |
| `assets` | D&D-Medienmetadaten, Image-Studio-Artefakte und Studio-Weltdateien. Brain-Dateien gehören ausdrücklich zu `admin_life`, nicht hierher. |
| `jobs` | Produktgetaggte Queue-Hüllen, Status, Logs und Connector-Ausführung. Payloads enthalten keine fachfremden privaten Inhalte. |
| `integrations` | Produktneutrale oder D&D-bezogene Connector-, Webhook-, Inferenz- und externe Dienstkonfiguration. Private Mail-/Kalenderverbindungen bleiben `admin_life`. |
| `ai_control` | Provider-, Gateway-, Budget-, Grant-, Nutzungs- und Promptsteuerung ohne private Prompt- oder Kontextinhalte. |
| `shared_reference` | Öffentliche, datenquellenneutrale Referenz- und Cache-Daten. Darf keine privaten UWE-Daten aufnehmen. |

Die Brain-only-Domänen im Sinne der Produktgrenze sind `personal_brain` und
`admin_life`; nur `audience: "brain"` darf ihre Inhalte lesen oder schreiben.
`dnd_brain` ist trotz des Namens eine Studio-Domäne und folgt der D&D-Gateway-
Policy.

### 1.3 `PrivacyClass`

| Wert | Harte Regel |
|---|---|
| `public` | Absichtlich veröffentlichte, anonym abrufbare Ausgabe. Veröffentlichung, Ziel-Scope und Minimierung bleiben erforderlich; der Wert entsteht nie allein aus einer App-Rolle. |
| `player_visible` | Nur nach serverseitiger Publish-, Visibility-, Membership-, Share- und Zielprüfung an berechtigte Portal-Verbraucher ausgebbar. Kann auf einen einzelnen Spieler begrenzt sein und ist nicht automatisch export- oder log-sicher. |
| `dm_only` | Nur für autorisierte Studio-/DM- beziehungsweise ausdrücklich benannte interne Ports. Nie Portal, statischer Export oder ungeschützter Cloud-Pfad. Vor zulässigem D&D-Cloud-Routing vollständig entfernen. Keine Konfiguration darf Portal oder Export freischalten. |
| `owner_private_local` | Nur `audience: "brain"` plus Rolle `owner`; Speicherung und Verarbeitung lokal beziehungsweise explizit LAN-begrenzt. Nie Cloud-KI, Portal, Studio, Share oder statischer Export. Diese Regel ist nicht konfigurierbar. |

Die Modellklassifikation unten ist der sichere Default der autoritativen
Tabelle. Bei D&D-Modellen mit `visibility`, `publishStatus`, Secret-/Reveal-
Feldern oder getrennten DM-/Player-Feldern darf ausschließlich ein
serverseitiger Projektor einzelne Ausgabefelder zu `player_visible` oder
`public` herabstufen. Das Rohmodell bleibt `dm_only`. Das bestehende
`playerPreviewAllowDmOnly`-Sonderverhalten ist mit diesem Zielvertrag nicht
vereinbar und muss vor Aktivierung der neuen Guards entfernt oder hart auf
Nicht-`dm_only` begrenzt werden.

## 2. Copy-paste-fähige TypeScript-Definitionen

Vorgeschlagene Datei `packages/product-contracts/src/domain-boundaries.ts`:

```typescript
export const APP_AUDIENCE = {
  portal: "portal",
  studio: "studio",
  brain: "brain",
  platform: "platform",
} as const;

export type AppAudience = (typeof APP_AUDIENCE)[keyof typeof APP_AUDIENCE];

export const DATA_DOMAIN = {
  dndWorld: "dnd_world",
  dndBrain: "dnd_brain",
  portalPlayer: "portal_player",
  personalBrain: "personal_brain",
  adminLife: "admin_life",
  platformAuth: "platform_auth",
  platformOps: "platform_ops",
  assets: "assets",
  jobs: "jobs",
  integrations: "integrations",
  aiControl: "ai_control",
  sharedReference: "shared_reference",
} as const;

export type DataDomain = (typeof DATA_DOMAIN)[keyof typeof DATA_DOMAIN];

export const PRIVACY_CLASS = {
  public: "public",
  playerVisible: "player_visible",
  dmOnly: "dm_only",
  ownerPrivateLocal: "owner_private_local",
} as const;

export type PrivacyClass = (typeof PRIVACY_CLASS)[keyof typeof PRIVACY_CLASS];

const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (values as readonly string[]).includes(value);

export const isAppAudience = (value: unknown): value is AppAudience =>
  isOneOf(Object.values(APP_AUDIENCE), value);

export const isDataDomain = (value: unknown): value is DataDomain =>
  isOneOf(Object.values(DATA_DOMAIN), value);

export const isPrivacyClass = (value: unknown): value is PrivacyClass =>
  isOneOf(Object.values(PRIVACY_CLASS), value);

export const BRAIN_ONLY_DATA_DOMAINS = [
  DATA_DOMAIN.personalBrain,
  DATA_DOMAIN.adminLife,
] as const satisfies readonly DataDomain[];

export function isBrainOnlyDataDomain(
  value: DataDomain,
): value is (typeof BRAIN_ONLY_DATA_DOMAINS)[number] {
  return isOneOf(BRAIN_ONLY_DATA_DOMAINS, value);
}
```

Vorgeschlagene Datei `packages/product-contracts/src/domain-access.ts`:

```typescript
import type { AppAudience, DataDomain } from "./domain-boundaries";

export const DOMAIN_ACCESS_MODE = {
  none: "none",
  read: "read",
  readWrite: "read_write",
  filteredProjection: "filtered_projection",
  scopedPort: "scoped_port",
  opaqueOrchestration: "opaque_orchestration",
} as const;

export type DomainAccessMode =
  (typeof DOMAIN_ACCESS_MODE)[keyof typeof DOMAIN_ACCESS_MODE];

const N = DOMAIN_ACCESS_MODE.none;
const R = DOMAIN_ACCESS_MODE.read;
const RW = DOMAIN_ACCESS_MODE.readWrite;
const FP = DOMAIN_ACCESS_MODE.filteredProjection;
const SP = DOMAIN_ACCESS_MODE.scopedPort;
const OO = DOMAIN_ACCESS_MODE.opaqueOrchestration;

export const AUDIENCE_DOMAIN_ACCESS = {
  portal: {
    dnd_world: FP, dnd_brain: N, portal_player: SP, personal_brain: N,
    admin_life: N, platform_auth: SP, platform_ops: N, assets: FP,
    jobs: SP, integrations: N, ai_control: N, shared_reference: R,
  },
  studio: {
    dnd_world: RW, dnd_brain: RW, portal_player: SP, personal_brain: N,
    admin_life: N, platform_auth: SP, platform_ops: N, assets: RW,
    jobs: SP, integrations: SP, ai_control: SP, shared_reference: R,
  },
  brain: {
    dnd_world: N, dnd_brain: N, portal_player: N, personal_brain: RW,
    admin_life: RW, platform_auth: SP, platform_ops: N, assets: N,
    jobs: SP, integrations: N, ai_control: SP, shared_reference: N,
  },
  platform: {
    dnd_world: OO, dnd_brain: OO, portal_player: OO, personal_brain: OO,
    admin_life: OO, platform_auth: RW, platform_ops: RW, assets: OO,
    jobs: RW, integrations: RW, ai_control: RW, shared_reference: RW,
  },
} as const satisfies Record<AppAudience, Record<DataDomain, DomainAccessMode>>;

export function getDomainAccess(
  audience: AppAudience,
  domain: DataDomain,
): DomainAccessMode {
  return AUDIENCE_DOMAIN_ACCESS[audience][domain];
}
```

`opaque_orchestration` bedeutet ausdrücklich `read: false` und `write: false`
für den fachlichen Inhalt: Platform darf Lifecycle, Handle, Größe, Status und
Integritätsmetadaten verwalten, aber den Payload weder interpretieren noch in
generischen Logs, Suche oder APIs offenlegen. `scoped_port` bedeutet einen
expliziten, validierten Use-Case-Contract und nie einen generischen Prisma-
Client. Unbekannte Audience-/Domain-Werte und nicht aufgeführte Kombinationen
werden abgewiesen.

## 3. Kompatibilitätsmatrix `AppAudience × DataDomain`

Legende: `R` = lesen, `RW` = lesen/schreiben, `FP` = ausschließlich gefilterte
Read-Projektion, `SP` = schmaler Use-Case-Port mit den dort explizit erlaubten
Reads/Writes, `OO` = opaque Orchestrierung ohne Inhaltszugriff, `—` = verboten.

| DataDomain | `portal` | `studio` | `brain` | `platform` |
|---|---:|---:|---:|---:|
| `dnd_world` | FP | RW | — | OO |
| `dnd_brain` | — | RW | — | OO |
| `portal_player` | SP | SP | — | OO |
| `personal_brain` | — | — | RW | OO |
| `admin_life` | — | — | RW | OO |
| `platform_auth` | SP | SP | SP | RW |
| `platform_ops` | — | — | — | RW |
| `assets` | FP | RW | — | OO |
| `jobs` | SP | SP | SP | RW |
| `integrations` | — | SP | — | RW |
| `ai_control` | — | SP | SP | RW |
| `shared_reference` | R | R | — | RW |

Zusätzliche, nicht durch die Matrix aufhebbare Regeln:

1. Portal-Projektionen prüfen Publish-, Visibility-, Secret-/Reveal-,
   Membership- und Share-Scope serverseitig. Portal schreibt niemals über den
   Projektionsport zurück.
2. Portal-Spielerwrites sind eine Allowlist einzelner Aktionen. Studio darf
   Spielerobjekte nur über Review-/Admin-Ports lesen oder beantworten.
3. D&D-Kontext folgt `SECURITY.md`: Gateway-Default `CLOUD_ALLOWED`, lokale
   Ausführung bevorzugt, Datenschutzmodus und Gateway-Policy dürfen weiter
   sperren; `dm_only` wird vor jeder Cloud-Route entfernt.
4. `personal_brain`, `admin_life` und alle daraus abgeleiteten Inhalte haben
   keinen Cloud-Fallback. Ein lokaler Ausfall führt zu Warten oder sicherem
   Fehler, niemals zu einer anderen Audience oder Domain.
5. Shared Engines haben keine `AppAudience`, keine Produkt-Credentials und
   keinen direkten Store-Zugriff. Sie erhalten minimale Daten über Ports und
   dürfen private Daten nicht persistieren.

## 4. Ziel-Storage-Notation

`uwe.db` bezeichnet die bestehende D&D-/Portal-/Platform-Datenebene;
`uwe-brain.db` die zukünftige physisch getrennte Brain-Datenbank. In der
Entwicklungsumgebung entspricht die erste heute
`packages/database/data/uwe.db`. Der endgültige Hostpfad und die
Dateisystemrechte von `uwe-brain.db` werden in der Migrationswelle festgelegt;
dieser Contract hardcodiert sie absichtlich nicht.

Die Mapping-Tabelle nennt zusätzlich einen logischen Datei-Storage:

| Storage-Wert | Zielpfad/Resolver |
|---|---|
| `—` | Nur Datenbankzeile; keine fachliche Dateiablage. |
| `studio-world-files` | `studio-files://worlds/{worldId}/{storageKey}`; physischer Resolver getrennt von Brain. |
| `brain-mail-files` | `brain-files://mail/{accountId}/{messageId}/{storageKey}`. |
| `brain-capture-files` | `brain-files://captures/{captureId}/{storageKey}`. |
| `brain-project-files` | `brain-files://projects/{projectId}/{storageKey}`. |
| `brain-workshop-files` | `brain-files://workshop/{projectId}/{storageKey}`. |
| `brain-recipe-files` | `brain-files://recipes/{recipeId}/{storageKey}`. |
| `brain-scan-files` | `brain-files://scans/{scanId}/{storageKey}`. |
| `platform-dev-files` | `platform-files://development/{entity}/{id}/{storageKey}`; keine Welt-Hilfsassets. |

Portal-Dateien sind keine weitere Source of Truth. Static Export schreibt nur
eine neu erzeugte, player-safe Projektion nach `exports/<world>-static/`
beziehungsweise in das konfigurierte Export-Root; `dm_only` und
`owner_private_local` sind davor ausgeschlossen.

## 5. Vollständiges Prisma-Modell-Mapping (142)

Aktualisiert 2026-07-22: die fünf 2D-Atlas-Modelle wurden im Zuge der
Atlas-3D-Wellen (PR #777–#782) entfernt und durch sechs `Atlas3D*`-Modelle
ersetzt. Atlas 3D besitzt per Owner-Entscheidung (2026-07-21, Schema-Kommentar)
bewusst keine Visibility-Spalten und ist vollständig spielersichtbar; die
Modelle erhalten deshalb `player_visible` statt des konservativen
`dm_only`-Defaults. Führt Atlas 3D später DM-only-Inhalte ein, sind zuerst
Visibility-Spalte und Projektor nachzurüsten.

`†G1` bis `†G10` markieren die zehn Prisma-relevanten Streitgruppen aus dem
Inventar. Die sichere Zielentscheidung steht in Abschnitt 6.

| Prisma-Modell | DataDomain | PrivacyClass | Ziel-DB | Ziel-Storage | Streitgruppe |
|---|---|---|---|---|---|
| `User` | `platform_auth` | `dm_only` | `uwe.db` | — | — |
| `DashboardLayout` | `platform_auth` | `dm_only` | `uwe.db` | — | — |
| `AuthIdentity` | `platform_auth` | `dm_only` | `uwe.db` | — | — |
| `Session` | `platform_auth` | `dm_only` | `uwe.db` | — | — |
| `WorldMembership` | `platform_auth` | `dm_only` | `uwe.db` | — | — |
| `SystemSettings` | `platform_ops` | `dm_only` | `uwe.db` | — | — |
| `AuditLog` | `platform_ops` | `dm_only` | `uwe.db` | — | — |
| `SeedHistory` | `platform_ops` | `dm_only` | `uwe.db` | — | — |
| `Job` | `jobs` | `dm_only` | `uwe.db` | — | — |
| `JobLog` | `jobs` | `dm_only` | `uwe.db` | — | — |
| `Connector` | `integrations` | `dm_only` | `uwe.db` | — | — |
| `ConnectorWorkflowDefault` | `integrations` | `dm_only` | `uwe.db` | — | — |
| `ConnectorJob` | `jobs` | `dm_only` | `uwe.db` | — | — |
| `DevAgentJob` | `jobs` | `dm_only` | `uwe.db` | — | — |
| `DevIdea` | `platform_ops` | `dm_only` | `uwe.db` | `platform-dev-files` | †G9 |
| `BugReport` | `platform_ops` | `dm_only` | `uwe.db` | `platform-dev-files` | †G9 |
| `ImportJob` | `jobs` | `dm_only` | `uwe.db` | — | †G5 |
| `ApiToken` | `platform_auth` | `dm_only` | `uwe.db` | — | — |
| `ApiTokenScope` | `platform_auth` | `dm_only` | `uwe.db` | — | — |
| `ApiTokenUsageLog` | `platform_auth` | `dm_only` | `uwe.db` | — | — |
| `WebhookEndpoint` | `integrations` | `dm_only` | `uwe.db` | — | — |
| `WebhookDelivery` | `integrations` | `dm_only` | `uwe.db` | — | — |
| `SecurityWarning` | `platform_ops` | `dm_only` | `uwe.db` | — | — |
| `TwoFactorSecret` | `platform_auth` | `dm_only` | `uwe.db` | — | — |
| `TwoFactorChallenge` | `platform_auth` | `dm_only` | `uwe.db` | — | — |
| `InferenceEndpoint` | `integrations` | `dm_only` | `uwe.db` | — | †G8 |
| `AiGatewayConfig` | `ai_control` | `dm_only` | `uwe.db` | — | — |
| `AiCloudProvider` | `ai_control` | `dm_only` | `uwe.db` | — | — |
| `AiUserGrant` | `ai_control` | `dm_only` | `uwe.db` | — | — |
| `AiUsageLog` | `ai_control` | `dm_only` | `uwe.db` | — | — |
| `Tag` | `platform_ops` | `dm_only` | `uwe.db` | — | †G7 |
| `EntityTag` | `platform_ops` | `dm_only` | `uwe.db` | — | †G7 |
| `PromptTemplate` | `ai_control` | `dm_only` | `uwe.db` | — | — |
| `PagePlayerAccess` | `portal_player` | `player_visible` | `uwe.db` | — | — |
| `PlayerQuestFlag` | `portal_player` | `player_visible` | `uwe.db` | — | — |
| `SessionAvailability` | `portal_player` | `player_visible` | `uwe.db` | — | — |
| `SessionUnlock` | `portal_player` | `player_visible` | `uwe.db` | — | — |
| `Character` | `portal_player` | `player_visible` | `uwe.db` | — | †G1 |
| `CharacterSpell` | `portal_player` | `player_visible` | `uwe.db` | — | †G1 |
| `PartyTreasury` | `portal_player` | `player_visible` | `uwe.db` | — | †G1 |
| `InventoryItem` | `portal_player` | `player_visible` | `uwe.db` | — | †G1 |
| `PlayerNote` | `portal_player` | `player_visible` | `uwe.db` | — | — |
| `ShareLink` | `portal_player` | `dm_only` | `uwe.db` | — | — |
| `ShareAccessLog` | `portal_player` | `dm_only` | `uwe.db` | — | — |
| `PlayerQuestion` | `portal_player` | `player_visible` | `uwe.db` | — | — |
| `DndApiCacheEntry` | `shared_reference` | `public` | `uwe.db` | — | — |
| `World` | `dnd_world` | `dm_only` | `uwe.db` | — | — |
| `Campaign` | `dnd_world` | `dm_only` | `uwe.db` | — | — |
| `Page` | `dnd_world` | `dm_only` | `uwe.db` | — | — |
| `WorldCalendar` | `dnd_world` | `dm_only` | `uwe.db` | — | — |
| `WorldEvent` | `dnd_world` | `dm_only` | `uwe.db` | — | — |
| `WorldEventEntityLink` | `dnd_world` | `dm_only` | `uwe.db` | — | — |
| `FactionState` | `dnd_world` | `dm_only` | `uwe.db` | — | — |
| `StructuredStatblock` | `dnd_world` | `dm_only` | `uwe.db` | — | — |
| `GameSession` | `dnd_world` | `dm_only` | `uwe.db` | — | — |
| `GameSessionPageLink` | `dnd_world` | `dm_only` | `uwe.db` | — | — |
| `ContentBlock` | `dnd_world` | `dm_only` | `uwe.db` | — | — |
| `Asset` | `assets` | `dm_only` | `uwe.db` | `studio-world-files` | †G9 |
| `AssetAlbum` | `assets` | `dm_only` | `uwe.db` | — | †G9 |
| `AssetAlbumItem` | `assets` | `dm_only` | `uwe.db` | — | †G9 |
| `AssetPageLink` | `assets` | `dm_only` | `uwe.db` | — | †G9 |
| `PageLink` | `dnd_world` | `dm_only` | `uwe.db` | — | — |
| `LabelTemplate` | `dnd_world` | `dm_only` | `uwe.db` | — | — |
| `Label` | `dnd_world` | `dm_only` | `uwe.db` | — | — |
| `PrintList` | `dnd_world` | `dm_only` | `uwe.db` | — | — |
| `PrintListItem` | `dnd_world` | `dm_only` | `uwe.db` | — | — |
| `SoundboardButton` | `dnd_world` | `dm_only` | `uwe.db` | — | — |
| `SoundboardButtonPageLink` | `dnd_world` | `dm_only` | `uwe.db` | — | — |
| `ContentReview` | `dnd_world` | `dm_only` | `uwe.db` | — | — |
| `ReviewComment` | `dnd_world` | `dm_only` | `uwe.db` | — | — |
| `SpotifyConnection` | `integrations` | `dm_only` | `uwe.db` | — | — |
| `ActivityLog` | `dnd_world` | `dm_only` | `uwe.db` | — | †G10 |
| `UndoEntry` | `dnd_world` | `dm_only` | `uwe.db` | — | — |
| `PageTemplate` | `dnd_world` | `dm_only` | `uwe.db` | — | — |
| `AiRun` | `dnd_brain` | `dm_only` | `uwe.db` | — | — |
| `AiProposal` | `dnd_brain` | `dm_only` | `uwe.db` | — | — |
| `AiApplyLog` | `dnd_brain` | `dm_only` | `uwe.db` | — | — |
| `BrainDocument` | `dnd_brain` | `dm_only` | `uwe.db` | — | — |
| `BrainChunk` | `dnd_brain` | `dm_only` | `uwe.db` | — | — |
| `BrainFact` | `dnd_brain` | `dm_only` | `uwe.db` | — | — |
| `BrainLink` | `dnd_brain` | `dm_only` | `uwe.db` | — | — |
| `GeneratorPreset` | `dnd_brain` | `dm_only` | `uwe.db` | — | — |
| `GeneratorOutput` | `dnd_brain` | `dm_only` | `uwe.db` | — | — |
| `ImageStudioProject` | `assets` | `dm_only` | `uwe.db` | `studio-world-files` | †G4 |
| `ImageStudioVersion` | `assets` | `dm_only` | `uwe.db` | `studio-world-files` | †G4 |
| `ImageStudioLink` | `assets` | `dm_only` | `uwe.db` | — | †G4 |
| `DndBeyondReference` | `integrations` | `dm_only` | `uwe.db` | — | — |
| `PageVersion` | `dnd_world` | `dm_only` | `uwe.db` | — | — |
| `RollTable` | `dnd_world` | `dm_only` | `uwe.db` | — | — |
| `Atlas3DWorld` | `dnd_world` | `player_visible` | `uwe.db` | — | — |
| `Atlas3DNode` | `dnd_world` | `player_visible` | `uwe.db` | — | — |
| `Atlas3DTerrain` | `dnd_world` | `player_visible` | `uwe.db` | — | — |
| `Atlas3DFeature` | `dnd_world` | `player_visible` | `uwe.db` | — | — |
| `Atlas3DObject` | `dnd_world` | `player_visible` | `uwe.db` | — | — |
| `Atlas3DCameraBookmark` | `dnd_world` | `player_visible` | `uwe.db` | — | — |
| `SessionLiveEntry` | `dnd_world` | `dm_only` | `uwe.db` | — | — |
| `StructuredItem` | `dnd_world` | `dm_only` | `uwe.db` | — | — |
| `MailTemplate` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | †G2 |
| `MailRecipientGroup` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | †G2 |
| `MailRecipient` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | †G2 |
| `MailMessageLog` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | †G2 |
| `MailAccount` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | †G2 |
| `MailFolder` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | †G2 |
| `MailInboxMessage` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | †G2 |
| `MailAttachment` | `admin_life` | `owner_private_local` | `uwe-brain.db` | `brain-mail-files` | †G2 |
| `MailPriorityScore` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | †G2 |
| `MailAiAction` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | †G2 |
| `MailUnsubscribeRequest` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | †G2 |
| `MailAuditLog` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | †G2 |
| `MailDraft` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | †G2 |
| `MailRule` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | †G2 |
| `MailVipSender` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | †G2 |
| `CaptureEntry` | `admin_life` | `owner_private_local` | `uwe-brain.db` | `brain-capture-files` | †G9 |
| `PersonalProject` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | — |
| `ProjectStep` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | — |
| `ProjectImage` | `admin_life` | `owner_private_local` | `uwe-brain.db` | `brain-project-files` | †G9 |
| `WorkshopProject` | `admin_life` | `owner_private_local` | `uwe-brain.db` | `brain-workshop-files` | †G9 |
| `WorkshopPaintRecipe` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | — |
| `WorkshopPrintProfile` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | — |
| `WorkshopTerrainRental` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | — |
| `ContractExpense` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | — |
| `HardwareDevice` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | — |
| `PersonalBrainDocument` | `personal_brain` | `owner_private_local` | `uwe-brain.db` | — | — |
| `PersonalBrainChunk` | `personal_brain` | `owner_private_local` | `uwe-brain.db` | — | — |
| `PersonalBrainFact` | `personal_brain` | `owner_private_local` | `uwe-brain.db` | — | — |
| `AdminEntityLink` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | — |
| `CalendarFeed` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | †G3 |
| `CalendarEvent` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | †G3 |
| `MiniatureCollectionItem` | `admin_life` | `owner_private_local` | `uwe-brain.db` | `brain-workshop-files` | †G9 |
| `DocumentTemplate` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | — |
| `ResearchSession` | `personal_brain` | `owner_private_local` | `uwe-brain.db` | — | †G6 |
| `ResearchSource` | `personal_brain` | `owner_private_local` | `uwe-brain.db` | — | †G6 |
| `Recipe` | `admin_life` | `owner_private_local` | `uwe-brain.db` | `brain-recipe-files` | †G9 |
| `RecipeIngredient` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | — |
| `MealPlanWeek` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | — |
| `MealPlanEntry` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | — |
| `ShoppingList` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | — |
| `ShoppingListItem` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | — |
| `BringConnection` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | — |
| `ScanDocument` | `admin_life` | `owner_private_local` | `uwe-brain.db` | `brain-scan-files` | †G9 |
| `MaintenanceTask` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | — |
| `PantryItem` | `admin_life` | `owner_private_local` | `uwe-brain.db` | — | — |

### 5.1 Copy-paste-fähige Mapping-Konstante

Vorgeschlagene Datei
`packages/product-contracts/src/prisma-model-boundaries.ts`. Die expliziten
Keys erlauben einen Contract-Test gegen die Prisma-DMMF; bei hinzugefügten oder
entfernten Modellen muss der Test fehlschlagen.

```typescript
import type { DataDomain, PrivacyClass } from "./domain-boundaries";

export type TargetDatabase = "uwe.db" | "uwe-brain.db";
export type StorageTarget =
  | "database_only"
  | "studio_world_files"
  | "brain_mail_files"
  | "brain_capture_files"
  | "brain_project_files"
  | "brain_workshop_files"
  | "brain_recipe_files"
  | "brain_scan_files"
  | "platform_dev_files";
export type DisputedBoundaryGroup =
  | "G1" | "G2" | "G3" | "G4" | "G5"
  | "G6" | "G7" | "G8" | "G9" | "G10";

export interface PrismaModelBoundary {
  readonly domain: DataDomain;
  readonly privacyClass: PrivacyClass;
  readonly targetDatabase: TargetDatabase;
  readonly storage: StorageTarget;
  readonly disputedGroup?: DisputedBoundaryGroup;
}

const boundary = <
  const D extends DataDomain,
  const P extends PrivacyClass,
  const DB extends TargetDatabase,
  const S extends StorageTarget,
>(domain: D, privacyClass: P, targetDatabase: DB, storage: S, disputedGroup?: DisputedBoundaryGroup) =>
  ({ domain, privacyClass, targetDatabase, storage, ...(disputedGroup ? { disputedGroup } : {}) } as const);

const U = <const D extends DataDomain, const P extends PrivacyClass>(
  domain: D, privacy: P, storage: StorageTarget = "database_only", group?: DisputedBoundaryGroup,
) => boundary(domain, privacy, "uwe.db", storage, group);
const B = <const D extends DataDomain>(
  domain: D, storage: StorageTarget = "database_only", group?: DisputedBoundaryGroup,
) => boundary(domain, "owner_private_local", "uwe-brain.db", storage, group);

export const PRISMA_MODEL_BOUNDARIES = {
  User: U("platform_auth", "dm_only"),
  DashboardLayout: U("platform_auth", "dm_only"),
  AuthIdentity: U("platform_auth", "dm_only"),
  Session: U("platform_auth", "dm_only"),
  WorldMembership: U("platform_auth", "dm_only"),
  PagePlayerAccess: U("portal_player", "player_visible"),
  PlayerQuestFlag: U("portal_player", "player_visible"),
  SessionAvailability: U("portal_player", "player_visible"),
  SessionUnlock: U("portal_player", "player_visible"),
  World: U("dnd_world", "dm_only"),
  Campaign: U("dnd_world", "dm_only"),
  Page: U("dnd_world", "dm_only"),
  WorldCalendar: U("dnd_world", "dm_only"),
  WorldEvent: U("dnd_world", "dm_only"),
  WorldEventEntityLink: U("dnd_world", "dm_only"),
  FactionState: U("dnd_world", "dm_only"),
  Character: U("portal_player", "player_visible", "database_only", "G1"),
  CharacterSpell: U("portal_player", "player_visible", "database_only", "G1"),
  PartyTreasury: U("portal_player", "player_visible", "database_only", "G1"),
  InventoryItem: U("portal_player", "player_visible", "database_only", "G1"),
  StructuredStatblock: U("dnd_world", "dm_only"),
  GameSession: U("dnd_world", "dm_only"),
  GameSessionPageLink: U("dnd_world", "dm_only"),
  ContentBlock: U("dnd_world", "dm_only"),
  Asset: U("assets", "dm_only", "studio_world_files", "G9"),
  AssetAlbum: U("assets", "dm_only", "database_only", "G9"),
  AssetAlbumItem: U("assets", "dm_only", "database_only", "G9"),
  AssetPageLink: U("assets", "dm_only", "database_only", "G9"),
  PageLink: U("dnd_world", "dm_only"),
  LabelTemplate: U("dnd_world", "dm_only"),
  Label: U("dnd_world", "dm_only"),
  PrintList: U("dnd_world", "dm_only"),
  PrintListItem: U("dnd_world", "dm_only"),
  SoundboardButton: U("dnd_world", "dm_only"),
  SoundboardButtonPageLink: U("dnd_world", "dm_only"),
  PlayerNote: U("portal_player", "player_visible"),
  ContentReview: U("dnd_world", "dm_only"),
  ReviewComment: U("dnd_world", "dm_only"),
  ShareLink: U("portal_player", "dm_only"),
  ShareAccessLog: U("portal_player", "dm_only"),
  SpotifyConnection: U("integrations", "dm_only"),
  SystemSettings: U("platform_ops", "dm_only"),
  ActivityLog: U("dnd_world", "dm_only", "database_only", "G10"),
  AuditLog: U("platform_ops", "dm_only"),
  UndoEntry: U("dnd_world", "dm_only"),
  PageTemplate: U("dnd_world", "dm_only"),
  SeedHistory: U("platform_ops", "dm_only"),
  AiRun: U("dnd_brain", "dm_only"),
  AiProposal: U("dnd_brain", "dm_only"),
  AiApplyLog: U("dnd_brain", "dm_only"),
  BrainDocument: U("dnd_brain", "dm_only"),
  BrainChunk: U("dnd_brain", "dm_only"),
  BrainFact: U("dnd_brain", "dm_only"),
  BrainLink: U("dnd_brain", "dm_only"),
  Job: U("jobs", "dm_only"),
  JobLog: U("jobs", "dm_only"),
  Connector: U("integrations", "dm_only"),
  ConnectorWorkflowDefault: U("integrations", "dm_only"),
  ConnectorJob: U("jobs", "dm_only"),
  MailTemplate: B("admin_life", "database_only", "G2"),
  MailRecipientGroup: B("admin_life", "database_only", "G2"),
  MailRecipient: B("admin_life", "database_only", "G2"),
  MailMessageLog: B("admin_life", "database_only", "G2"),
  MailAccount: B("admin_life", "database_only", "G2"),
  MailFolder: B("admin_life", "database_only", "G2"),
  MailInboxMessage: B("admin_life", "database_only", "G2"),
  MailAttachment: B("admin_life", "brain_mail_files", "G2"),
  MailPriorityScore: B("admin_life", "database_only", "G2"),
  MailAiAction: B("admin_life", "database_only", "G2"),
  MailUnsubscribeRequest: B("admin_life", "database_only", "G2"),
  MailAuditLog: B("admin_life", "database_only", "G2"),
  MailDraft: B("admin_life", "database_only", "G2"),
  MailRule: B("admin_life", "database_only", "G2"),
  MailVipSender: B("admin_life", "database_only", "G2"),
  CaptureEntry: B("admin_life", "brain_capture_files", "G9"),
  PersonalProject: B("admin_life"),
  ProjectStep: B("admin_life"),
  ProjectImage: B("admin_life", "brain_project_files", "G9"),
  WorkshopProject: B("admin_life", "brain_workshop_files", "G9"),
  WorkshopPaintRecipe: B("admin_life"),
  WorkshopPrintProfile: B("admin_life"),
  WorkshopTerrainRental: B("admin_life"),
  ContractExpense: B("admin_life"),
  HardwareDevice: B("admin_life"),
  PersonalBrainDocument: B("personal_brain"),
  PersonalBrainChunk: B("personal_brain"),
  PersonalBrainFact: B("personal_brain"),
  AdminEntityLink: B("admin_life"),
  GeneratorPreset: U("dnd_brain", "dm_only"),
  GeneratorOutput: U("dnd_brain", "dm_only"),
  ImageStudioProject: U("assets", "dm_only", "studio_world_files", "G4"),
  ImageStudioVersion: U("assets", "dm_only", "studio_world_files", "G4"),
  ImageStudioLink: U("assets", "dm_only", "database_only", "G4"),
  CalendarFeed: B("admin_life", "database_only", "G3"),
  CalendarEvent: B("admin_life", "database_only", "G3"),
  DevAgentJob: U("jobs", "dm_only"),
  DevIdea: U("platform_ops", "dm_only", "platform_dev_files", "G9"),
  BugReport: U("platform_ops", "dm_only", "platform_dev_files", "G9"),
  MiniatureCollectionItem: B("admin_life", "brain_workshop_files", "G9"),
  ImportJob: U("jobs", "dm_only", "database_only", "G5"),
  DocumentTemplate: B("admin_life"),
  DndBeyondReference: U("integrations", "dm_only"),
  DndApiCacheEntry: U("shared_reference", "public"),
  ApiToken: U("platform_auth", "dm_only"),
  ApiTokenScope: U("platform_auth", "dm_only"),
  ApiTokenUsageLog: U("platform_auth", "dm_only"),
  WebhookEndpoint: U("integrations", "dm_only"),
  WebhookDelivery: U("integrations", "dm_only"),
  SecurityWarning: U("platform_ops", "dm_only"),
  TwoFactorSecret: U("platform_auth", "dm_only"),
  TwoFactorChallenge: U("platform_auth", "dm_only"),
  InferenceEndpoint: U("integrations", "dm_only", "database_only", "G8"),
  PageVersion: U("dnd_world", "dm_only"),
  RollTable: U("dnd_world", "dm_only"),
  ResearchSession: B("personal_brain", "database_only", "G6"),
  ResearchSource: B("personal_brain", "database_only", "G6"),
  Atlas3DWorld: U("dnd_world", "player_visible"),
  Atlas3DNode: U("dnd_world", "player_visible"),
  Atlas3DTerrain: U("dnd_world", "player_visible"),
  Atlas3DFeature: U("dnd_world", "player_visible"),
  Atlas3DObject: U("dnd_world", "player_visible"),
  Atlas3DCameraBookmark: U("dnd_world", "player_visible"),
  AiGatewayConfig: U("ai_control", "dm_only"),
  AiCloudProvider: U("ai_control", "dm_only"),
  AiUserGrant: U("ai_control", "dm_only"),
  AiUsageLog: U("ai_control", "dm_only"),
  Tag: U("platform_ops", "dm_only", "database_only", "G7"),
  EntityTag: U("platform_ops", "dm_only", "database_only", "G7"),
  SessionLiveEntry: U("dnd_world", "dm_only"),
  Recipe: B("admin_life", "brain_recipe_files", "G9"),
  RecipeIngredient: B("admin_life"),
  MealPlanWeek: B("admin_life"),
  MealPlanEntry: B("admin_life"),
  ShoppingList: B("admin_life"),
  ShoppingListItem: B("admin_life"),
  BringConnection: B("admin_life"),
  StructuredItem: U("dnd_world", "dm_only"),
  PlayerQuestion: U("portal_player", "player_visible"),
  ScanDocument: B("admin_life", "brain_scan_files", "G9"),
  PromptTemplate: U("ai_control", "dm_only"),
  MaintenanceTask: B("admin_life"),
  PantryItem: B("admin_life"),
} as const satisfies Record<string, PrismaModelBoundary>;

export type PrismaModelName = keyof typeof PRISMA_MODEL_BOUNDARIES;

export function isPrismaModelName(value: unknown): value is PrismaModelName {
  return typeof value === "string" && value in PRISMA_MODEL_BOUNDARIES;
}
```

## 6. Entscheidungen zu den zehn Streitgruppen

| Gruppe | Inventar-Hotspot | Verbindliche Zielentscheidung |
|---|---|---|
| G1 | `Character`, `CharacterSpell`, `PartyTreasury`, `InventoryItem` | Portal ist fachlicher Owner. O03 definiert pro Aktion und Feld eine Write-Allowlist; Studio erhält explizite DM-Review-/Override-Ports, keinen generischen Tabellenzugriff über Portal. |
| G2 | Weltbezogene Mailmodelle | Alle heutigen Mailmodelle werden Brain/`admin_life` und `uwe-brain.db` zugeordnet. Studio bekommt später einen minimalen Kampagnenmail-Port; Adressen, Inbox, Entwürfe und Mailinhalt werden weder Studio-Repository noch Cloud-Kontext. |
| G3 | `CalendarFeed`, `CalendarEvent` | Beide werden Brain/`admin_life`. D&D-Termine bleiben in `GameSession`/`WorldEvent`; eine Studio-/Portal-Kalenderansicht ist deren Projektion und übernimmt keine Feed-Credentials. |
| G4 | Image Studio mit Brain-Zieltypen | Die drei heutigen Image-Studio-Modelle bleiben Studio/`assets`; Brain-Zieltypen sind darin künftig ungültig. Brain erhält einen getrennten privaten Media-Port und Brain-eigene Metadaten/Dateipfade. |
| G5 | `ImportJob` mit gemischten Targets | Platform speichert nur produktgetaggten Lifecycle und opaque Input-/Ergebnis-Handles. D&D-Preview liegt im Studio-Port, Brain-Preview in Brain; ein gemeinsames `previewPayload` mit privatem Inhalt ist unzulässig. |
| G6 | `ResearchSession`, `ResearchSource` | Wegen `life_brain` gilt der harte Zielwert Brain/`personal_brain`. D&D-Research wird in einen separaten Studio-Contract und Store extrahiert; ein gemischter `contextMode` darf die Cloud-Policy nicht auswählen. |
| G7 | `Tag`, `EntityTag` | Die heutigen Platform-Modelle verbleiben nur für Platform-/Studio-Namespaces in `uwe.db`. Brain-Tags und -Links werden in `uwe-brain.db` produktlokal modelliert; Counts und Entity-Existenz kreuzen die Grenze nicht. |
| G8 | Cookbook versus `InferenceEndpoint` | `InferenceEndpoint` bleibt Platform/`integrations` und enthält nur Endpoint-/Capability-Metadaten. Private Modellnutzung und Empfehlungen gehören Brain; Brain erhält nur einen lokalen Capability-Handle, keine Platform-Konfigurationsrechte. |
| G9 | Gemischte Uploadroots und Datei-Referenzen | `Asset` ist ausschließlich Studio. Brain- und Platform-Dateimodelle nutzen die in Abschnitt 4 getrennten Resolver; Hilfswelten und `data/uploads/<worldId>` sind für Brain-/Platform-Dateien unzulässig. |
| G10 | `ActivityLog` versus Cockpit/Audit | `ActivityLog` wird D&D-/Studio-spezifisch. Platform nutzt `AuditLog`; Brain erhält bei Bedarf ein eigenes minimiertes Auditmodell ohne private Titel, Snippets oder Cross-Product-Feed. |

Das Inventar enthält außerdem drei strittige Bereiche ohne eigene Prisma-
Zielzuordnung: die überholte Privacy-Dokumentation, die gemischte Suchroute und
die Backup-Pfadabweichung. Sie ändern die Zahl der klassifizierten Modelle
nicht. Suche wird in getrennte Studio-/Brain-Ports geschnitten; Backup-Pfade
werden vor der physischen Migration separat kanonisiert.

## 7. Session-Audience: Zielkonzept, keine Cookie-Änderung

Heute verwenden Studio und Portal weiterhin das gemeinsame Cookie
`uwe_session` und die gemeinsame Platform-Session. Dieser Contract ändert weder
Cookie-Name noch Session-Schema, Login, Middleware oder Logout.

Im Ziel trägt jede neu ausgestellte App-Session genau eine `AppAudience`.
Serverseitige Guards prüfen Audience, Rolle und fachlichen Scope gemeinsam:
Portal zusätzlich Membership/Projektion, Studio seine DM-/Admin-Rechte und
Brain zwingend Rolle `owner` plus lokales/LAN-Exposure. `platform` ist für
Platform-Routen und Service-Identitäten vorgesehen, nicht als browserseitiger
Generalschlüssel. Eine Audience ist notwendig, aber nie hinreichend. Replay
einer Portal-Session gegen Studio oder Brain wird deny-by-default abgewiesen.

## 8. Paket-Ort und Moduldisziplin

Empfehlung: neues, framework-agnostisches Package `packages/product-contracts`
mit dem Namen `@uwe/product-contracts` und Subpath-Exports für
`./audience`, `./domain-access`, `./privacy` und
`./prisma-model-boundaries`.

Begründung:

- Die Contracts sind eine Security-/Architekturgrenze und keine allgemeine
  Utility; ein eigenes Package macht Abhängigkeiten und Reviews sichtbar.
- Das Package enthält keine DB-Clients, I/O, App-Imports, Provider oder
  private Repository-Zugriffe und kann von Auth, Jobs, AI und Storage genutzt
  werden.
- Es wächst weder `packages/database/src/server.ts` noch ein eingefrorener
  Barrel. Neue Symbole werden ausschließlich über Subpath-Exports angeboten.
- Die Implementierung wird in kleine Dateien unter 300 Zeilen geteilt; die
  Prisma-Zuordnung kann nach Produkt in mehrere interne Dateien zerlegt werden,
  damit jede neue Produktionsdatei unter 700 Zeilen bleibt.
- `@uwe/shared-utils` bleibt für generische Utilities frei. Falls kein neues
  Package genehmigt wird, ist ein isolierter Subpath
  `@uwe/shared-utils/product-contracts` nur die zweite Wahl und darf keine
  bestehende breite Barrel-Datei vergrößern.

## 9. Übergabe an O03/O04

O03 soll die Wertelisten unverändert übernehmen und zuerst folgende Ports und
Negativtests definieren:

1. Audience-Guard mit deny-by-default für unbekannte/replayed Audiences;
2. Portal Read Models plus Feld-Allowlist für G1 und übrige Spieleraktionen;
3. getrennte D&D-/Brain-Verträge für AI-Kontext, Research, Kalender, Mail,
   Import und Image Studio;
4. Job-Envelopes mit `audience`, `dataDomain`, `privacyClass`, Schema-Version
   und opaque Payload-Handle statt untypisiertem Cross-Product-JSON;
5. Contract-Tests gegen alle Prisma-DMMF-Modellnamen sowie den harten Ausschluss
   von `owner_private_local` aus Portal, Studio, Cloud und Export.

O04 soll auf dieser Zuordnung die Storage-/Datenebene planen:

1. getrennte Prisma-Clients und Repository-Credentials für `uwe.db` und
   `uwe-brain.db`, ohne Dual-Store-Client in Apps oder Shared Engines;
2. Resolver für die logischen Studio-, Brain- und Platform-Dateipfade;
3. separate Brain-Backups, Retention, Restore-Autorisierung und
   Vollständigkeitsprüfung;
4. Dry Run, Mengen-/Beziehungs-/Dateiintegrität, Rollback und explizite
   Owner-Freigabe vor Cutover; keine Löschung in der Contract-Welle;
5. Migrationsentscheidungen für G2 bis G10, bevor Foreign Keys oder
   polymorphe Links physisch getrennt werden.

## 10. Risiken und verpflichtende Gegenmaßnahmen

- **Modell-Default versus Zeilensichtbarkeit:** Fast alle D&D-Source-Modelle
  sind konservativ `dm_only`. Ein zentraler, getesteter Projektor muss die
  wenigen ausgabefähigen Felder ableiten; Clients dürfen nicht selbst filtern.
- **Aktuelle Preview-Ausnahme:** Der vorhandene DM-only-Share-Bypass kollidiert
  mit der harten Zielinvariante und ist vor Guard-Aktivierung zu schließen.
- **Gemischte polymorphe IDs:** `EntityTag`, `AdminEntityLink`,
  `ImageStudioLink` und Job-JSON besitzen keine physische DB-Grenze. Ohne
  produktgetrennte Schemas entstehen Metadatenleaks und ungültige Cross-DB-FKs.
- **Platform-Orchestrierung:** Backup, Queue, Connector und Diagnose können
  versehentlich private Payloads loggen. Opaque Handles, Minimierung und
  produktbezogene Credentials sind zwingend.
- **Cloud-Policy-Drift:** Ältere Texte nennen D&D local-only. Operativ gilt
  `SECURITY.md`: D&D kann nach Gateway-Policy in die Cloud, aber erst nach
  vollständigem `dm_only`-Filter; Personal Brain bleibt immer lokal.
- **Physischer Pfad noch offen:** Der endgültige Hostpfad von `uwe-brain.db`
  und Brain-Backups ist bewusst nicht vorweggenommen. O04 muss ihn vor jeder
  Migration samt Rechten, Restore und Rollback festlegen.
- **Mapping-Drift:** Neue Prisma-Modelle dürfen CI nur passieren, wenn
  `PRISMA_MODEL_BOUNDARIES` und die zugehörigen Negativtests aktualisiert sind.
