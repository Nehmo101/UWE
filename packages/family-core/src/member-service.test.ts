import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  createTestFamilyClient,
  type FamilyPrismaClient,
} from "@uwe/database/test-helpers";
import { FAMILY_MEMBER_COLOURS } from "./member-colours";
import { createFamilyMemberService, type FamilyMemberService } from "./member-service";

describe("FamilyMemberService", () => {
  let db: FamilyPrismaClient;
  let service: FamilyMemberService;

  before(() => {
    db = createTestFamilyClient();
    service = createFamilyMemberService(db);
  });

  after(async () => {
    await db.$disconnect();
  });

  it("legt ein Mitglied ohne Konto an — Kleinkind oder Haustier", async () => {
    const cat = await service.createMember({ displayName: "Mimi", kind: "pet" });

    assert.equal(cat.userId, null);
    assert.equal(cat.kind, "pet");
    assert.equal(cat.isActive, true);
    assert.ok(cat.id.length > 0);
  });

  it("vergibt automatisch eine freie Farbe aus der Palette", async () => {
    const a = await service.createMember({ displayName: "Farbe A" });
    const b = await service.createMember({ displayName: "Farbe B" });

    assert.ok(FAMILY_MEMBER_COLOURS.includes(a.colour));
    assert.ok(FAMILY_MEMBER_COLOURS.includes(b.colour));
    assert.notEqual(a.colour, b.colour);
  });

  it("übernimmt eine ausdrücklich gesetzte Farbe normalisiert", async () => {
    const member = await service.createMember({
      displayName: "Eigene Farbe",
      colour: "#ABCDEF",
    });
    assert.equal(member.colour, "#abcdef");
  });

  it("weist einen leeren Namen zurück", async () => {
    await assert.rejects(
      () => service.createMember({ displayName: "   " }),
      /braucht einen Namen/,
    );
  });

  it("legt beim ersten Besuch ein Mitglied für das Konto an", async () => {
    const created = await service.ensureMemberForUser({
      userId: "usr_ensure",
      displayName: "Anna",
    });
    assert.equal(created.userId, "usr_ensure");

    const again = await service.ensureMemberForUser({
      userId: "usr_ensure",
      displayName: "Anna",
    });
    assert.equal(again.id, created.id, "kein zweites Mitglied für dasselbe Konto");
  });

  it("hält den Anzeigenamen des Kontos aktuell", async () => {
    await service.ensureMemberForUser({ userId: "usr_rename", displayName: "Alt" });
    const updated = await service.ensureMemberForUser({
      userId: "usr_rename",
      displayName: "Neu",
    });
    assert.equal(updated.displayName, "Neu");
  });

  it("verknüpft ein Mitglied ohne Konto nachträglich mit einer Benutzer-ID", async () => {
    const member = await service.createMember({ displayName: "Später mit Konto" });
    const linked = await service.linkMemberToUser(member.id, "usr_later");

    assert.equal(linked.userId, "usr_later");
    assert.equal((await service.getMemberByUserId("usr_later"))?.id, member.id);
  });

  it("verhindert, dass ein Konto zwei Mitgliedern gehört", async () => {
    await service.createMember({ displayName: "Erster", userId: "usr_taken" });
    const other = await service.createMember({ displayName: "Zweiter" });

    await assert.rejects(
      () => service.linkMemberToUser(other.id, "usr_taken"),
      /bereits einem anderen Mitglied/,
    );
  });

  it("löscht ein Mitglied ohne Konto wirklich", async () => {
    const guest = await service.createMember({ displayName: "Gast", kind: "guest" });
    const result = await service.removeMember(guest.id);

    assert.equal(result, null);
    assert.equal(await service.getMember(guest.id), null);
  });

  it("deaktiviert ein Mitglied mit Konto, statt es zu löschen", async () => {
    const member = await service.createMember({
      displayName: "Mit Konto",
      userId: "usr_deactivate",
    });
    const result = await service.removeMember(member.id);

    assert.equal(result?.isActive, false);
    assert.ok(await service.getMember(member.id), "Zeile bleibt bestehen");
  });

  it("blendet deaktivierte Mitglieder standardmäßig aus", async () => {
    const member = await service.createMember({ displayName: "Inaktiv" });
    await service.updateMember(member.id, { isActive: false });

    const visible = await service.listMembers();
    const all = await service.listMembers({ includeInactive: true });

    assert.ok(!visible.some((m) => m.id === member.id));
    assert.ok(all.some((m) => m.id === member.id));
  });

  it("speichert Geburtstag und Jahrestag", async () => {
    const member = await service.createMember({
      displayName: "Mit Daten",
      birthdayOn: new Date(Date.UTC(2019, 5, 14)),
      anniversaryOn: new Date(Date.UTC(2015, 7, 22)),
      anniversaryLabel: "  Hochzeitstag  ",
    });

    assert.deepEqual(member.birthdayOn, new Date(Date.UTC(2019, 5, 14)));
    assert.equal(member.anniversaryLabel, "Hochzeitstag");
  });

  it("leert die Farbe, wenn eine ungültige gesetzt wird", async () => {
    const member = await service.createMember({ displayName: "Farbe weg" });
    const updated = await service.updateMember(member.id, { colour: "kein-hex" });
    assert.equal(updated.colour, "");
  });
});
