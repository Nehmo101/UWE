import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  createTestFamilyClient,
  type FamilyPrismaClient,
} from "@uwe/database/test-helpers";
import { createFamilyMemberService } from "./member-service";
import {
  FAMILY_CALENDAR_TOKEN_PREFIX,
  createFamilyCalendarSubscriptionService,
  isFamilyCalendarTokenFormat,
  type FamilyCalendarSubscriptionService,
} from "./subscription-service";

describe("isFamilyCalendarTokenFormat", () => {
  it("erkennt gültige Feed-Tokens", () => {
    assert.ok(isFamilyCalendarTokenFormat(`${FAMILY_CALENDAR_TOKEN_PREFIX}${"a".repeat(48)}`));
  });

  it("weist fremde Präfixe und zu kurze Werte zurück", () => {
    assert.ok(!isFamilyCalendarTokenFormat(`uwe_${"a".repeat(48)}`));
    assert.ok(!isFamilyCalendarTokenFormat(`${FAMILY_CALENDAR_TOKEN_PREFIX}kurz`));
    assert.ok(!isFamilyCalendarTokenFormat(""));
  });
});

describe("FamilyCalendarSubscriptionService", () => {
  let db: FamilyPrismaClient;
  let service: FamilyCalendarSubscriptionService;

  before(() => {
    db = createTestFamilyClient();
    service = createFamilyCalendarSubscriptionService(db);
  });

  after(async () => {
    await db.$disconnect();
  });

  it("gibt den Token genau einmal im Klartext zurück", async () => {
    const created = await service.createSubscription({ label: "iPhone Anna" });

    assert.ok(created.token.startsWith(FAMILY_CALENDAR_TOKEN_PREFIX));

    const stored = await db.familyCalendarSubscription.findUnique({
      where: { id: created.id },
    });
    assert.ok(stored);
    assert.notEqual(stored.tokenHash, created.token, "Klartext darf nicht gespeichert sein");
    assert.ok(!JSON.stringify(stored).includes(created.token));
  });

  it("speichert ein wiedererkennbares Präfix", async () => {
    const created = await service.createSubscription({ label: "Mit Praefix" });
    const stored = await db.familyCalendarSubscription.findUnique({
      where: { id: created.id },
    });

    assert.ok(created.token.startsWith(stored?.tokenPrefix ?? "@@"));
  });

  it("löst einen gültigen Token auf", async () => {
    const created = await service.createSubscription({ label: "Gueltig" });
    const resolved = await service.resolveByToken(created.token);

    assert.equal(resolved?.id, created.id);
  });

  it("weist einen unbekannten Token zurück", async () => {
    const resolved = await service.resolveByToken(
      `${FAMILY_CALENDAR_TOKEN_PREFIX}${"0".repeat(48)}`,
    );
    assert.equal(resolved, null);
  });

  it("weist einen Token in fremdem Format zurück, ohne die Datenbank zu fragen", async () => {
    assert.equal(await service.resolveByToken("nicht-mal-ein-token"), null);
    assert.equal(await service.resolveByToken(""), null);
  });

  it("weist einen widerrufenen Token zurück", async () => {
    const created = await service.createSubscription({ label: "Widerrufen" });
    await service.revokeSubscription(created.id);

    assert.equal(await service.resolveByToken(created.token), null);
  });

  it("bindet ein Abo optional an ein Mitglied", async () => {
    const members = createFamilyMemberService(db);
    const anna = await members.createMember({ displayName: "Anna Abo" });

    const created = await service.createSubscription({
      label: "Nur Anna",
      memberIds: [anna.id],
    });

    assert.deepEqual((await service.resolveByToken(created.token))?.memberIds, [anna.id]);
  });

  it("bindet ein Abo an mehrere Mitglieder", async () => {
    const members = createFamilyMemberService(db);
    const lino = await members.createMember({ displayName: "Lino Abo" });
    const mimi = await members.createMember({ displayName: "Mimi Abo" });

    const created = await service.createSubscription({
      label: "Tablet der Kinder",
      memberIds: [lino.id, mimi.id, lino.id, "  "],
    });

    assert.deepEqual(created.memberIds, [lino.id, mimi.id], "doppelt und leer fallen weg");
    assert.deepEqual(
      [...((await service.resolveByToken(created.token))?.memberIds ?? [])].sort(),
      [lino.id, mimi.id].sort(),
    );

    const listed = (await service.listSubscriptions()).find((row) => row.id === created.id);
    assert.deepEqual(
      listed?.members.map((member) => member.displayName),
      ["Lino Abo", "Mimi Abo"],
    );
  });

  it("ohne Mitglied gilt das Abo für den ganzen Haushalt", async () => {
    const created = await service.createSubscription({ label: "Ganzer Haushalt" });

    assert.deepEqual(created.memberIds, []);
    assert.deepEqual((await service.resolveByToken(created.token))?.memberIds, []);
  });

  it("ändert die Personen eines bestehenden Abos", async () => {
    const members = createFamilyMemberService(db);
    const a = await members.createMember({ displayName: "Wechsel A" });
    const b = await members.createMember({ displayName: "Wechsel B" });

    const created = await service.createSubscription({ label: "Wechsel", memberIds: [a.id] });

    await service.setSubscriptionMembers(created.id, [a.id, b.id]);
    // Erneut dieselbe Auswahl darf nicht am Primärschlüssel scheitern.
    await service.setSubscriptionMembers(created.id, [a.id, b.id]);

    assert.deepEqual(
      [...((await service.resolveByToken(created.token))?.memberIds ?? [])].sort(),
      [a.id, b.id].sort(),
    );

    await service.setSubscriptionMembers(created.id, []);
    assert.deepEqual((await service.resolveByToken(created.token))?.memberIds, []);
  });

  it("löscht ein auf Personen eingeschränktes Abo mit der letzten Person", async () => {
    const members = createFamilyMemberService(db);
    const solo = await members.createMember({ displayName: "Einziger im Abo" });
    const created = await service.createSubscription({
      label: "Nur diese Person",
      memberIds: [solo.id],
    });

    await members.removeMember(solo.id);

    // Sonst würde aus einem persönlichen Abo stillschweigend eines für den
    // ganzen Haushalt.
    assert.equal(await service.resolveByToken(created.token), null);
  });

  it("vermerkt die Nutzung", async () => {
    const created = await service.createSubscription({ label: "Genutzt" });
    await service.markUsed(created.id);

    const stored = await db.familyCalendarSubscription.findUnique({
      where: { id: created.id },
    });
    assert.ok(stored?.lastUsedAt instanceof Date);
  });

  it("setzt einen Ersatznamen, wenn keiner angegeben ist", async () => {
    const created = await service.createSubscription({ label: "   " });
    assert.equal(created.label, "Kalender-Abo");
  });

  it("erzeugt für jedes Abo einen anderen Token", async () => {
    const a = await service.createSubscription({ label: "A" });
    const b = await service.createSubscription({ label: "B" });
    assert.notEqual(a.token, b.token);
  });

  it("löscht ein Abo vollständig", async () => {
    const created = await service.createSubscription({ label: "Weg" });
    await service.deleteSubscription(created.id);

    assert.equal(
      await db.familyCalendarSubscription.findUnique({ where: { id: created.id } }),
      null,
    );
  });
});
