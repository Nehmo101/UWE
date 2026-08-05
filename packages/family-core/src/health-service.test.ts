import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  createTestFamilyClient,
  type FamilyPrismaClient,
} from "@uwe/database/test-helpers";
import { createFamilyHealthService, type FamilyHealthService } from "./health-service";
import { createFamilyMemberService } from "./member-service";

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("FamilyHealthService", () => {
  let db: FamilyPrismaClient;
  let service: FamilyHealthService;
  let cat: { id: string };
  let child: { id: string };

  before(async () => {
    db = createTestFamilyClient();
    service = createFamilyHealthService(db);
    const members = createFamilyMemberService(db);
    cat = await members.createMember({ displayName: "Mimi", kind: "pet" });
    child = await members.createMember({ displayName: "Lino", kind: "child" });
  });

  after(async () => {
    await db.$disconnect();
  });

  it("legt einen Tierarzt-Eintrag für die Katze an", async () => {
    const record = await service.createRecord({
      memberId: cat.id,
      kind: "vet",
      title: "Tollwut-Impfung",
      occurredOn: utc(2026, 3, 1),
      nextDueOn: utc(2027, 3, 1),
    });

    assert.equal(record.kind, "vet");
    assert.equal(record.title, "Tollwut-Impfung");
    assert.deepEqual(record.nextDueOn, utc(2027, 3, 1));
  });

  it("weist eine leere Bezeichnung zurück", async () => {
    await assert.rejects(
      () => service.createRecord({ memberId: cat.id, title: "  " }),
      /braucht eine Bezeichnung/,
    );
  });

  it("listet die Einträge eines Mitglieds, jüngste zuerst", async () => {
    const member = (await createFamilyMemberService(db).createMember({
      displayName: "Sortierung",
    })) as { id: string };

    await service.createRecord({
      memberId: member.id,
      title: "Alt",
      occurredOn: utc(2024, 1, 1),
    });
    await service.createRecord({
      memberId: member.id,
      title: "Neu",
      occurredOn: utc(2026, 1, 1),
    });

    const list = await service.listForMember(member.id);
    assert.deepEqual(
      list.map((r) => r.title),
      ["Neu", "Alt"],
    );
  });

  it("liefert nur Fälligkeiten im gefragten Zeitraum", async () => {
    const member = (await createFamilyMemberService(db).createMember({
      displayName: "Faellig",
    })) as { id: string };

    await service.createRecord({
      memberId: member.id,
      title: "Bald",
      nextDueOn: utc(2026, 8, 1),
    });
    await service.createRecord({
      memberId: member.id,
      title: "Spaeter",
      nextDueOn: utc(2027, 8, 1),
    });
    await service.createRecord({ memberId: member.id, title: "Ohne Faelligkeit" });

    const due = await service.listDueUntil(utc(2026, 12, 31), utc(2026, 1, 1));
    const titles = due.filter((r) => r.memberId === member.id).map((r) => r.title);

    assert.deepEqual(titles, ["Bald"]);
  });

  it("liefert zur Fälligkeit das Mitglied mit", async () => {
    await service.createRecord({
      memberId: child.id,
      kind: "checkup",
      title: "U9",
      nextDueOn: utc(2026, 9, 15),
    });

    const due = await service.listDueUntil(utc(2026, 12, 31), utc(2026, 1, 1));
    const entry = due.find((r) => r.title === "U9");

    assert.equal(entry?.member.displayName, "Lino");
    assert.equal(entry?.member.kind, "child");
  });

  it("sortiert Fälligkeiten aufsteigend", async () => {
    const member = (await createFamilyMemberService(db).createMember({
      displayName: "Reihenfolge",
    })) as { id: string };

    await service.createRecord({
      memberId: member.id,
      title: "Zweite",
      nextDueOn: utc(2026, 11, 1),
    });
    await service.createRecord({
      memberId: member.id,
      title: "Erste",
      nextDueOn: utc(2026, 10, 1),
    });

    const due = await service.listDueUntil(utc(2026, 12, 31), utc(2026, 1, 1));
    const mine = due.filter((r) => r.memberId === member.id).map((r) => r.title);

    assert.deepEqual(mine, ["Erste", "Zweite"]);
  });

  it("liefert im Zeitraum sowohl Fälligkeit als auch Vergangenes", async () => {
    const member = (await createFamilyMemberService(db).createMember({
      displayName: "Zeitraum",
    })) as { id: string };

    await service.createRecord({
      memberId: member.id,
      title: "War im Monat",
      occurredOn: utc(2026, 5, 3),
    });
    await service.createRecord({
      memberId: member.id,
      title: "Faellig im Monat",
      nextDueOn: utc(2026, 5, 20),
    });
    await service.createRecord({
      memberId: member.id,
      title: "Daneben",
      occurredOn: utc(2026, 4, 30),
      nextDueOn: utc(2026, 6, 1),
    });
    await service.createRecord({ memberId: member.id, title: "Ohne Datum" });

    const rows = await service.listInRange(utc(2026, 5, 1), utc(2026, 5, 31));
    const titles = rows
      .filter((r) => r.memberId === member.id)
      .map((r) => r.title)
      .sort();

    assert.deepEqual(titles, ["Faellig im Monat", "War im Monat"]);
    assert.equal(rows[0]?.member.displayName !== undefined, true);
  });

  it("ändert einen Eintrag", async () => {
    const record = await service.createRecord({ memberId: cat.id, title: "Vorher" });
    const updated = await service.updateRecord(record.id, {
      title: "Nachher",
      kind: "medication",
      notes: "  zweimal taeglich  ",
    });

    assert.equal(updated.title, "Nachher");
    assert.equal(updated.kind, "medication");
    assert.equal(updated.notes, "zweimal taeglich");
  });

  it("löscht einen Eintrag", async () => {
    const record = await service.createRecord({ memberId: cat.id, title: "Weg" });
    await service.deleteRecord(record.id);

    assert.equal(await service.getRecord(record.id), null);
  });

  it("räumt die Akte mit dem Mitglied ab", async () => {
    const members = createFamilyMemberService(db);
    const temp = await members.createMember({ displayName: "Temporaer Akte" });
    await service.createRecord({ memberId: temp.id, title: "Eintrag" });

    await members.removeMember(temp.id);

    assert.deepEqual(await service.listForMember(temp.id), []);
  });
});
