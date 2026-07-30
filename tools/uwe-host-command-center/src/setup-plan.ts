/**
 * Der Einrichtungsplan: aus der App-Auswahl wird eine geordnete, endliche
 * Schrittliste.
 *
 * Bewusst eine reine Funktion ohne Prozess-Start — dadurch ist „was passiert
 * bei dieser Auswahl" testbar, und `desktop-host.ts` bleibt der einzige Ort,
 * der Prozesse startet. Die Länge der Liste ist zugleich das Total des
 * Fortschrittsbalkens, weshalb `setupStepCount` denselben Plan benutzt statt
 * eine Konstante zu raten.
 */
import { HOST_SERVICE_IDS, HOST_SERVICE_LABELS, type HostServiceId } from "./desktop-host-types.ts";
import { isAppSelected, type InstallSelection } from "./install-selection.ts";

/**
 * `workspace` läuft als `pnpm <args>` im Projektordner.
 * `seed` ist derselbe Aufruf, wird aber zur Laufzeit nur bei frischer bzw.
 * vorgemerkter Datenbank ausgeführt — der Balken zählt ihn trotzdem, damit
 * „wie weit sind wir" bei Erst- und Reparatureinrichtung gleich ehrlich ist.
 */
export type SetupStepKind = "workspace" | "seed";

export interface SetupStepPlan {
  /** Stabile ID für Fortschrittsereignisse und Logs. */
  phase: string;
  /** Menschenlesbarer Text im Fortschrittsbalken. */
  label: string;
  kind: SetupStepKind;
  /** Argumente für `pnpm`. */
  args: string[];
  /** Bezeichnung im Einrichtungs-Log. */
  logLabel: string;
  env?: Record<string, string>;
}

/** Der Prisma-Filter je Datenbank. `uwe.db` trägt Konten und Einstellungen und läuft immer. */
const DATABASE_STEPS: ReadonlyArray<{
  app: HostServiceId | null;
  phase: string;
  label: string;
  logLabel: string;
  script: string;
}> = [
  { app: null, phase: "migrate", label: "Datenbank migrieren", logLabel: "Datenbankmigration", script: "db:deploy" },
  {
    app: "brain",
    phase: "migrate-brain",
    label: "Brain-Datenbank migrieren",
    logLabel: "Brain-Datenbankmigration",
    script: "db:deploy:brain",
  },
  {
    app: "family",
    phase: "migrate-family",
    label: "Family-Datenbank migrieren",
    logLabel: "Family-Datenbankmigration",
    script: "db:deploy:family",
  },
];

/** pnpm-Filter je App — die Build-Schritte des Plans. */
const BUILD_FILTERS: Record<HostServiceId, string> = {
  studio: "@uwe/studio",
  portal: "@uwe/portal",
  brain: "@uwe/brain",
  family: "@uwe/family",
  landing: "@uwe/landing",
};

export interface SetupPlanContext {
  root: string;
  dataRoot: string;
}

export function buildSetupPlan(
  selection: InstallSelection,
  context: SetupPlanContext,
): SetupStepPlan[] {
  const steps: SetupStepPlan[] = [
    {
      phase: "install",
      label: "Abhängigkeiten installieren",
      kind: "workspace",
      args: ["install", "--frozen-lockfile"],
      logLabel: "Abhängigkeiten",
    },
    {
      // Erzeugt alle Prisma-Clients (uwe, brain, family, postgres) auf einmal —
      // unabhängig davon, welche Datenbanken danach migriert werden.
      phase: "prisma",
      label: "Prisma-Client generieren",
      kind: "workspace",
      args: ["--filter", "@uwe/database", "db:generate"],
      logLabel: "Prisma Client",
    },
  ];

  for (const step of DATABASE_STEPS) {
    if (step.app && !isAppSelected(selection, step.app)) continue;
    steps.push({
      phase: step.phase,
      label: step.label,
      kind: "workspace",
      args: ["--filter", "@uwe/database", step.script],
      logLabel: step.logLabel,
    });
  }

  if (selection.seedDemoContent) {
    steps.push({
      phase: "seed",
      label: "Demo-Grundbestand einspielen",
      kind: "seed",
      args: ["--filter", "@uwe/database", "db:seed"],
      logLabel: "Demo-Grundbestand",
      env: { UWE_ALLOW_PROD_SEED: "1" },
    });
  }

  steps.push({
    phase: "connector",
    label: "Lokalen Maschinenraum einrichten",
    kind: "workspace",
    args: [
      "exec",
      "tsx",
      "tools/uwe-host-command-center/src/provision-local-connector.ts",
      "--root",
      context.root,
    ],
    logLabel: "Lokaler Maschinenraum",
    env: { UWE_COMMAND_CENTER_DATA_DIR: context.dataRoot },
  });

  let gebaut = 0;
  for (const app of HOST_SERVICE_IDS) {
    if (!isAppSelected(selection, app)) continue;
    gebaut += 1;
    steps.push({
      phase: `${app}-build`,
      label: `${HOST_SERVICE_LABELS[app]}: Produktions-Build`,
      kind: "workspace",
      args: ["--filter", BUILD_FILTERS[app], "build"],
      logLabel: `${HOST_SERVICE_LABELS[app]} Produktions-Build`,
    });
  }

  // Next.js legt in `.next/standalone` weder `static/` noch `public/` ab — das
  // ist eine dokumentierte Upstream-Eigenschaft, kein Fehler. Im Monorepo hängt
  // deshalb an `pnpm build` der Materialize-Lauf, der beides (plus die
  // Prisma-Laufzeit) in den Standalone-Baum kopiert. Die Schritte oben rufen
  // aber `pnpm --filter @uwe/<app> build` auf, also nur `next build` — ohne
  // diesen Nachlauf fehlt der Kopierschritt komplett.
  //
  // `desktop-host.ts` startet genau diesen Standalone-Server, sobald
  // `server.js` existiert. Ohne die Assets liefert der Host dann zwar
  // vollständiges HTML aus, aber jede `/_next/static/*`-URL (CSS, JS-Chunks,
  // next/font-Dateien) und jedes public/-Asset 404t — sichtbar als Seiten ganz
  // ohne Design, in jeder App gleichzeitig.
  if (gebaut > 0) {
    steps.push({
      phase: "standalone-assets",
      label: "Standalone-Laufzeit vervollständigen",
      kind: "workspace",
      args: ["exec", "node", "scripts/materialize-standalone-prisma-deps.mjs"],
      logLabel: "Standalone-Laufzeit",
    });
  }

  return steps;
}

/**
 * Anzahl der Schritte für diese Auswahl — das Total des Fortschrittsbalkens.
 * Der Kontext beeinflusst die Länge nicht, deshalb reichen Platzhalter.
 */
export function setupStepCount(selection: InstallSelection): number {
  return buildSetupPlan(selection, { root: "", dataRoot: "" }).length;
}
