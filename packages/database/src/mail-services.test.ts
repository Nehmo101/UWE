import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { createPrismaClient, type PrismaClient } from "./client";
import { createMailComposeService } from "./mail-compose-service";
import { createMailLogService } from "./mail-log-service";
import { createMailRecipientService } from "./mail-recipient-service";
import { createMailTemplateService } from "./mail-template-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("mail-services", () => {
  let db: PrismaClient;

  before(() => {
    db = createPrismaClient(createTestDatabaseUrl());
  });

  describe("mail-template-service", () => {
    it("seeds system templates and lists them", async () => {
      const templates = createMailTemplateService(db);
      const listed = await templates.listTemplates();

      const systemSlugs = listed.filter((t) => t.isSystem).map((t) => t.slug);
      assert.ok(systemSlugs.includes("session-recap"));
      assert.ok(systemSlugs.includes("system-warning"));
      assert.ok(systemSlugs.includes("backup-warning"));
    });

    it("creates and updates a world-scoped custom template", async () => {
      const world = await db.world.create({
        data: { name: "Mail Template World", slug: "mail-template-world" },
      });
      const templates = createMailTemplateService(db);

      const created = await templates.createTemplate(world.id, {
        name: "Eigene Einladung",
        subject: "Einladung: {{sessionTitle}}",
        bodyText: "Hallo {{playerName}}",
      });
      assert.equal(created.slug, "eigene-einladung");
      assert.equal(created.isSystem, false);
      assert.equal(created.kind, "custom");

      const updated = await templates.updateTemplate(world.id, created.slug, {
        subject: "Neue Einladung: {{sessionTitle}}",
        isActive: false,
      });
      assert.equal(updated.subject, "Neue Einladung: {{sessionTitle}}");
      assert.equal(updated.isActive, false);

      const worldTemplate = await templates.getTemplate(created.slug, world.id);
      assert.equal(worldTemplate?.id, created.id);
    });
  });

  describe("mail-log-service", () => {
    it("creates a log entry with a body preview when body logging is enabled", async () => {
      const logs = createMailLogService(db);
      const entry = await logs.create({
        subject: "Session-Recap",
        toAddresses: ["player@test.local"],
        fromAddress: "uwe@test.local",
        bodyLogged: true,
        bodyText: "Die Gruppe erreichte den runden Turm.",
      });

      assert.equal(entry.status, "pending");
      assert.deepEqual(entry.toAddresses, ["player@test.local"]);
      assert.ok(entry.bodyPreview?.includes("runden Turm"));
    });

    it("marks entries as sent or failed and filters by status", async () => {
      const logs = createMailLogService(db);
      const first = await logs.create({
        subject: "Erste Mail",
        toAddresses: ["a@test.local"],
        fromAddress: "uwe@test.local",
      });
      const second = await logs.create({
        subject: "Zweite Mail",
        toAddresses: ["b@test.local"],
        fromAddress: "uwe@test.local",
      });

      const sent = await logs.markSent(first.id, "msg-123");
      assert.equal(sent.status, "sent");
      assert.ok(sent.sentAt);

      const failed = await logs.markFailed(second.id, "SMTP nicht erreichbar");
      assert.equal(failed.status, "failed");
      assert.equal(failed.errorMessage, "SMTP nicht erreichbar");

      const failedList = await logs.list({ status: "failed" });
      assert.ok(failedList.some((entry) => entry.id === second.id));
      assert.equal(
        failedList.some((entry) => entry.id === first.id),
        false,
      );
    });
  });

  describe("mail-recipient-service", () => {
    it("creates a group and adds recipients with email validation", async () => {
      const world = await db.world.create({
        data: { name: "Mail Recipient World", slug: "mail-recipient-world" },
      });
      const recipients = createMailRecipientService(db);

      const group = await recipients.createGroup(world.slug, {
        name: "Stammtisch",
        description: "Feste Runde",
      });
      assert.equal(group.slug, "stammtisch");
      assert.equal(group.recipients.length, 0);

      const withRecipient = await recipients.addRecipient(world.slug, group.slug, {
        email: "Player@Test.Local",
        name: "Spieler Eins",
      });
      assert.equal(withRecipient.recipients.length, 1);
      assert.equal(withRecipient.recipients[0]?.email, "player@test.local");

      await assert.rejects(
        recipients.addRecipient(world.slug, group.slug, { email: "keine-adresse" }),
        /Ungültige E-Mail-Adresse/,
      );
    });

    it("syncs player memberships into the system players group", async () => {
      const world = await db.world.create({
        data: { name: "Mail Players World", slug: "mail-players-world" },
      });
      const player = await db.user.create({
        data: {
          displayName: "Mail Player",
          email: "mail-player@test.local",
          role: "player",
        },
      });
      await db.worldMembership.create({
        data: {
          userId: player.id,
          worldId: world.id,
          role: "player",
          characterName: "Aria",
        },
      });

      const recipients = createMailRecipientService(db);
      const group = await recipients.ensurePlayersGroup(world.slug);

      assert.equal(group.slug, "players");
      assert.equal(group.isSystem, true);
      assert.equal(group.recipients.length, 1);
      assert.equal(group.recipients[0]?.email, "mail-player@test.local");
      assert.equal(group.recipients[0]?.name, "Aria");
    });
  });

  describe("mail-compose-service", () => {
    it("composes a session recap draft from session data", async () => {
      const world = await db.world.create({
        data: { name: "Mail Compose World", slug: "mail-compose-world" },
      });
      const session = await db.gameSession.create({
        data: {
          worldId: world.id,
          title: "Der runde Turm",
          sessionNumber: 3,
          summaryPlayer: "Die Gruppe fand den Eingang.",
        },
      });

      const compose = createMailComposeService(db);
      const draft = await compose.composeSessionRecap(world.slug, session.id);

      assert.ok(draft);
      assert.ok(draft?.subject.includes("Der runde Turm"));
      assert.ok(draft?.bodyText.includes("Die Gruppe fand den Eingang."));

      const missing = await compose.composeSessionRecap(world.slug, "unknown-session");
      assert.equal(missing, null);
    });

    it("renders the system warning template with variables", async () => {
      const compose = createMailComposeService(db);
      const draft = await compose.composeSystemWarning(
        "Speicher knapp",
        "Nur noch 5% frei.",
      );

      assert.equal(draft.subject, "UWE Systemhinweis: Speicher knapp");
      assert.ok(draft.bodyText.includes("Nur noch 5% frei."));
    });
  });
});
