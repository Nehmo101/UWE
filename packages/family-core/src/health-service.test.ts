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
      memberIds: [cat.id],
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
      () => service.createRecord({ memberIds: [cat.id], title: "  " }),
      /braucht eine Bezeichnung/,
    );
  });

  it("legt einen Eintrag für mehrere Personen an", async () => {
    const record = await service.createRecord({
      memberIds: [cat.id, child.id],
      kind: "vaccination",
      title: "Grippeimpfung",
      nextDueOn: utc(2026, 10, 5),
    });

    assert.deepEqual(
      record.members.map((member) => member.displayName),
      ["Lino", "Mimi"],
      "nach Anzeigename sortiert",
    );

    // Der Eintrag taucht in beiden Akten auf, nicht nur in einer.
    for (const member of [cat, child]) {
      const titles = (await service.listForMember(member.id)).map((entry) => entry.title);
      assert.ok(titles.includes("Grippeimpfung"));
    }
  });

  it("verwirft doppelte und leere Kennungen", async () => {
    const record = await service.createRecord({
      memberIds: [cat.id, cat.id, "  ", ""],
      title: "Nur einmal Mimi",
    });

    assert.deepEqual(
      record.members.map((member) => member.id),
      [cat.id],
    );
  });

  it("weist einen Eintrag ohne Person zurück", async () => {
    await assert.rejects(
      () => service.createRecord({ memberIds: [], title: "Niemandes Eintrag" }),
      /mindestens eine Person/,
    );
  });

  it("ändert die Zuordnung eines bestehenden Eintrags", async () => {
    const record = await service.createRecord({
      memberIds: [cat.id],
      title: "Erst die Katze",
    });

    await service.setRecordMembers(record.id, [child.id, cat.id]);
    assert.deepEqual(
      (await service.getRecord(record.id))?.members.map((member) => member.displayName),
      ["Lino", "Mimi"],
    );

    // Erneut dieselbe Auswahl darf nicht am Primärschlüssel scheitern.
    await service.setRecordMembers(record.id, [child.id, cat.id]);

    await service.setRecordMembers(record.id, [child.id]);
    assert.deepEqual(
      (await service.getRecord(record.id))?.members.map((member) => member.displayName),
      ["Lino"],
    );
  });

  it("lässt eine leere Zuordnung nicht zu", async () => {
    const record = await service.createRecord({ memberIds: [cat.id], title: "Bleibt bei Mimi" });

    await assert.rejects(() => service.setRecordMembers(record.id, []), /mindestens eine Person/);
    assert.equal((await service.getRecord(record.id))?.members.length, 1);
  });

  it("listet die Einträge eines Mitglieds, jüngste zuerst", async () => {
    const member = (await createFamilyMemberService(db).createMember({
      displayName: "Sortierung",
    })) as { id: string };

    await service.createRecord({
      memberIds: [member.id],
      title: "Alt",
      occurredOn: utc(2024, 1, 1),
    });
    await service.createRecord({
      memberIds: [member.id],
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
      memberIds: [member.id],
      title: "Bald",
      nextDueOn: utc(2026, 8, 1),
    });
    await service.createRecord({
      memberIds: [member.id],
      title: "Spaeter",
      nextDueOn: utc(2027, 8, 1),
    });
    await service.createRecord({ memberIds: [member.id], title: "Ohne Faelligkeit" });

    const due = await service.listDueUntil(utc(2026, 12, 31), utc(2026, 1, 1));
    const titles = due
      .filter((r) => r.members.some((m) => m.id === member.id))
      .map((r) => r.title);

    assert.deepEqual(titles, ["Bald"]);
  });

  it("liefert zur Fälligkeit das Mitglied mit", async () => {
    await service.createRecord({
      memberIds: [child.id],
      kind: "checkup",
      title: "U9",
      nextDueOn: utc(2026, 9, 15),
    });

    const due = await service.listDueUntil(utc(2026, 12, 31), utc(2026, 1, 1));
    const entry = due.find((r) => r.title === "U9");

    assert.deepEqual(
      entry?.members.map((m) => m.displayName),
      ["Lino"],
    );
    assert.equal(entry?.members[0]?.kind, "child");
  });

  it("sortiert Fälligkeiten aufsteigend", async () => {
    const member = (await createFamilyMemberService(db).createMember({
      displayName: "Reihenfolge",
    })) as { id: string };

    await service.createRecord({
      memberIds: [member.id],
      title: "Zweite",
      nextDueOn: utc(2026, 11, 1),
    });
    await service.createRecord({
      memberIds: [member.id],
      title: "Erste",
      nextDueOn: utc(2026, 10, 1),
    });

    const due = await service.listDueUntil(utc(2026, 12, 31), utc(2026, 1, 1));
    const mine = due
      .filter((r) => r.members.some((m) => m.id === member.id))
      .map((r) => r.title);

    assert.deepEqual(mine, ["Erste", "Zweite"]);
  });

  it("ändert einen Eintrag", async () => {
    const record = await service.createRecord({ memberIds: [cat.id], title: "Vorher" });
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
    const record = await service.createRecord({ memberIds: [cat.id], title: "Weg" });
    await service.deleteRecord(record.id);

    assert.equal(await service.getRecord(record.id), null);
  });

  it("räumt die Akte mit dem Mitglied ab", async () => {
    const members = createFamilyMemberService(db);
    const temp = await members.createMember({ displayName: "Temporaer Akte" });
    await service.createRecord({ memberIds: [temp.id], title: "Eintrag" });

    await members.removeMember(temp.id);

    assert.deepEqual(await service.listForMember(temp.id), []);
  });

  it("lässt einen geteilten Eintrag stehen, wenn nur eine Person geht", async () => {
    const members = createFamilyMemberService(db);
    const temp = await members.createMember({ displayName: "Temporaer Geteilt" });
    const shared = await service.createRecord({
      memberIds: [temp.id, child.id],
      title: "Gemeinsamer Eintrag",
    });

    await members.removeMember(temp.id);

    const left = await service.getRecord(shared.id);
    assert.deepEqual(
      left?.members.map((member) => member.displayName),
      ["Lino"],
    );
  });
});
