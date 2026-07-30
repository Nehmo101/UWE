import assert from "node:assert/strict";
import { describe, it } from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Dateien außerhalb dieses Pakets — hier @uwe/shared-ui — transpiliert tsx mit
// der klassischen JSX-Laufzeit, die ein globales `React` erwartet. Im Build
// erledigt @vitejs/plugin-react das für alle Dateien; im Test genügt der Verweis.
(globalThis as { React?: typeof React }).React = React;

import { OpsAuditLogView } from "./OpsAuditLogView";
import { OpsMigrationsView } from "./OpsMigrationsView";
import { OpsSecretsView } from "./OpsSecretsView";
import { OpsSecurityView } from "./OpsSecurityView";
import { OpsSetupView } from "./OpsSetupView";
import { OpsTokensView } from "./OpsTokensView";
import { OpsWebhooksView } from "./OpsWebhooksView";
import { dateTime, flag, text } from "./ops-view-kit";

/**
 * Die Betrieb-Ansichten gegen die tatsächlichen Nutzdaten des Hosts.
 *
 * Die Formen unten sind aus echten `ops-cli`-Antworten dieser Installation
 * übernommen (gekürzt). Der zweite Durchlauf mit leeren und kaputten Werten
 * hält das Versprechen fest, das die Ansichten geben: eine geänderte oder
 * fehlende Form macht eine Fläche höchstens lückenhaft, nie kaputt.
 */

const SECURITY = {
  timestamp: "2026-07-30T07:29:43.328Z",
  auth: { active: true, portalAuthRequired: true, message: "Portal-Login ist aktiv." },
  accessCounts: { owner: 1, portal: 1, studio: 1, brain: 1, family: 1 },
  networkProtection: { checklist: ["AUTH_REQUIRED=true?"], note: "Netzwerk-Schutz liegt bei Cloudflare." },
  env: {
    sessionSecret: { configured: true, strong: true, envKey: "SESSION_SECRET", message: "gesetzt und stark" },
    setupToken: { active: true, secure: true, message: "UWE_SETUP_TOKEN aktiv" },
    rtxServiceToken: { required: false, configured: false, envKey: "RTX_SERVICE_TOKEN", message: "Nicht erforderlich" },
  },
  publicRoutes: { playerRoutesPublic: false, studioAdminProtected: false, details: ["Portal Preview öffentlich: nein"] },
  backup: {
    lastBackupAt: "2026-07-26T13:41:44.075Z",
    lastBackupFilename: "uwe-backup-full.zip",
    restoreAvailable: true,
    backupCount: 2,
  },
  auditLog: [{ id: "a1", action: "seed_applied", summary: "System-Templates übernommen", createdAt: "2026-07-20T13:20:47.009Z" }],
  uploadPolicy: { maxSizeBytes: null, maxSizeLabel: "Kein Limit", allowedTypes: [".png"], note: "Keine MIME-Whitelist." },
  aiPolicy: { enabled: true, localOnly: false, allowedModels: ["llama3.2"], rateLimits: ["Login: 8/5min"], message: "KI aktiv" },
  warnings: [{ id: "w1", severity: "critical", title: "Falsch konfiguriert", description: "Konfiguration widerspricht sich." }],
  studioSecurity: {
    publicExposureConfigured: true,
    proxyIndicators: { trustProxy: true, cloudflareTunnel: true, networkProtectionLikely: true },
    checks: { studioApiTokenConfigured: true, authSecretConfigured: false },
    misconfigurations: ["Öffentliche Erreichbarkeit mit schwachem AUTH"],
    nextSteps: ["Behebe die Konfigurationsprobleme in .env."],
  },
};

const SECRETS = {
  timestamp: "2026-07-30T07:30:11.270Z",
  ok: true,
  encryptionKeyConfigured: true,
  encryptionKeyEnvKey: "SESSION_SECRET",
  sections: [
    {
      id: "bootstrap",
      title: "Bootstrap (nur ENV)",
      description: "Host-Secrets ohne Klartext.",
      items: [
        {
          id: "auth-secret",
          label: "SESSION_SECRET",
          description: "Verschlüsselt DB-Secrets.",
          source: "env",
          status: "set",
          maskedHint: "nur ENV",
          envKey: "SESSION_SECRET",
        },
      ],
    },
  ],
  warnings: [{ id: "s1", severity: "info", title: "Hinweis: Rotation", description: "Rotation invalidiert Felder." }],
  rotationDueSecretIds: [],
};

const MIGRATIONS = {
  ok: true,
  appliedCount: 104,
  appliedMigrations: ["20260611214509_init_uwe_data_model", "20260729120000_letzte"],
  pendingMigrations: [],
  failedMigrations: [],
  failedDetails: [],
  message: "104 Migration(en) angewendet.",
};

const AUDIT = {
  limit: 3,
  count: 1,
  entries: [
    {
      id: "e1",
      worldSlug: "terra",
      action: "content_updated",
      targetType: "world",
      targetLabel: "Terra",
      summary: "8 Seite(n): gelöscht.",
      details: { feature: "page_bulk_edit", changedCount: 8 },
      createdAt: "2026-07-21T07:57:14.085Z",
      undo: { entryId: "u1", undoneAt: null },
    },
  ],
};

const TOKENS = {
  userId: "cmrxaz01l0000eo7g5wsibjc0",
  tokens: [
    {
      id: "t1",
      name: "Backup-Runner",
      tokenPrefix: "uwe_ab12",
      scopes: ["backup_read", "health_read"],
      isActive: true,
      expiresAt: null,
      lastUsedAt: "2026-07-29T10:00:00.000Z",
      createdAt: "2026-07-01T10:00:00.000Z",
    },
  ],
  availableScopes: ["health_read", "backup_read"],
};

const WEBHOOKS = {
  endpoints: [
    {
      id: "h1",
      name: "Discord",
      url: "https://example.invalid/hook",
      secretPrefix: "whsec_12",
      events: ["world.updated"],
      isActive: true,
      lastTriggeredAt: "2026-07-28T09:00:00.000Z",
      createdAt: "2026-07-01T09:00:00.000Z",
    },
  ],
  deliveries: {
    deliveries: [
      {
        id: "d1",
        endpointId: "h1",
        endpointName: "Discord",
        event: "world.updated",
        statusCode: 500,
        success: false,
        errorMessage: "Timeout",
        attemptCount: 3,
        createdAt: "2026-07-28T09:00:00.000Z",
        completedAt: null,
      },
    ],
    total: 1,
  },
};

const SETUP = {
  ok: false,
  canEdit: true,
  isOwner: true,
  timestamp: "2026-07-30T07:29:47.506Z",
  sections: [
    {
      id: "system",
      title: "System",
      level: "ok",
      statusLabel: "Bereit",
      message: "UWE 0.1.0 · production",
      nextSteps: ["Optional: Automatisches Backup aktivieren."],
      settings: [
        { id: "database", label: "Datenbank", configured: true, displayValue: "verbunden", source: "env", editable: false },
        { id: "smtp", label: "SMTP", configured: false, displayValue: "nicht gesetzt", source: "db", editable: true },
      ],
    },
  ],
};

describe("ops view formatting", () => {
  it("renders values the way an operator reads them", () => {
    assert.equal(flag(true), "Ja");
    assert.equal(flag(false), "Nein");
    assert.equal(flag(null), "—");
    assert.equal(text(null), "—");
    assert.equal(text(""), "—");
    assert.equal(text(1234), "1.234");
    assert.equal(dateTime(null), "—");
    assert.equal(dateTime("kein-datum"), "kein-datum");
    assert.match(dateTime("2026-07-21T07:57:14.085Z"), /2026/);
  });
});

describe("ops views over real host payloads", () => {
  it("shows security facts as named fields instead of JSON", () => {
    const html = renderToStaticMarkup(<OpsSecurityView data={SECURITY} />);
    assert.match(html, /Portal verlangt Anmeldung/);
    assert.match(html, /Falsch konfiguriert/); // Warnung mit Schweregrad
    assert.match(html, /SESSION_SECRET/);
    assert.match(html, /Öffentliche Erreichbarkeit mit schwachem AUTH/);
    assert.match(html, /uwe-backup-full\.zip/);
  });

  it("marks a missing secret apart from a set one", () => {
    const html = renderToStaticMarkup(<OpsSecretsView data={SECRETS} />);
    assert.match(html, /Bootstrap \(nur ENV\)/);
    assert.match(html, /gesetzt/);
    assert.match(html, /nur ENV/);
  });

  it("puts pending and failed migrations before the applied wall of names", () => {
    const html = renderToStaticMarkup(<OpsMigrationsView data={MIGRATIONS} />);
    assert.match(html, /Nichts ausstehend\./);
    assert.match(html, /Aktuell/);
    assert.ok(html.indexOf("Ausstehend") < html.indexOf("Angewendet ("));
  });

  it("renders audit entries as rows with target and time", () => {
    const html = renderToStaticMarkup(<OpsAuditLogView data={AUDIT} />);
    assert.match(html, /content updated/); // snake_case aufgelöst
    assert.match(html, /Terra/);
    assert.match(html, /Welt: terra/);
    assert.match(html, /8 Seite\(n\): gelöscht\./);
  });

  it("shows token metadata without ever showing a token", () => {
    const html = renderToStaticMarkup(<OpsTokensView data={TOKENS} />);
    assert.match(html, /Backup-Runner/);
    assert.match(html, /uwe_ab12/);
    assert.match(html, /backup_read, health_read/);
    assert.match(html, /aktiv/);
  });

  it("separates endpoints from their deliveries and flags failures", () => {
    const html = renderToStaticMarkup(<OpsWebhooksView data={WEBHOOKS} />);
    assert.match(html, /Discord/);
    assert.match(html, /whsec_12/);
    assert.match(html, /fehlgeschlagen/);
    assert.match(html, /Timeout/);
  });

  it("lists setup settings with value, source and state", () => {
    const html = renderToStaticMarkup(<OpsSetupView data={SETUP} />);
    assert.match(html, /Datenbank/);
    assert.match(html, /verbunden/);
    assert.match(html, /nicht änderbar/);
    assert.match(html, /offen/); // SMTP ist nicht konfiguriert
    assert.match(html, /Optional: Automatisches Backup aktivieren\./);
  });
});

describe("ops views survive unexpected payloads", () => {
  const views = [
    ["Security", OpsSecurityView],
    ["Secrets", OpsSecretsView],
    ["Migrationen", OpsMigrationsView],
    ["Audit-Log", OpsAuditLogView],
    ["API-Tokens", OpsTokensView],
    ["Webhooks", OpsWebhooksView],
    ["Einrichtung", OpsSetupView],
  ] as const;

  for (const [label, View] of views) {
    it(`renders ${label} for empty, wrong-typed and null payloads`, () => {
      for (const payload of [null, {}, [], "kaputt", { sections: "kein Array", entries: 42 }]) {
        assert.doesNotThrow(() => renderToStaticMarkup(<View data={payload} />));
      }
    });
  }
});
