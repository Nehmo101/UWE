import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  createTestFamilyClient,
  type FamilyPrismaClient,
} from "@uwe/database/test-helpers";
import {
  attachMembersToEvents,
  eventIdsForMember,
  memberIdsByEvent,
  setEventMembers,
} from "./event-members";
import { createFamilyMemberService, type FamilyMemberService } from "./member-service";

describe("Termin-Zuordnung zu Mitgliedern", () => {
  let db: FamilyPrismaClient;
  let members: FamilyMemberService;
  let anna: { id: string };
  let bea: { id: string };

  const makeEvent = async (title: string) =>
    db.calendarEvent.create({
      data: { title, startAt: new Date(Date.UTC(2026, 6, 1, 10)) },
    });

  before(async () => {
    db = createTestFamilyClient();
    members = createFamilyMemberService(db);
    anna = await members.createMember({ displayName: "Anna", colour: "#e11d48" });
    bea = await members.createMember({ displayName: "Bea", colour: "#2563eb" });
  });

  after(async () => {
    await db.$disconnect();
  });

  it("ordnet einen Termin mehreren Mitgliedern zu", async () => {
    const event = await makeEvent("Familienessen");
    await setEventMembers(db, event.id, [anna.id, bea.id]);

    const byEvent = await memberIdsByEvent(db, [event.id]);
    assert.deepEqual(new Set(byEvent.get(event.id)), new Set([anna.id, bea.id]));
  });

  it("ersetzt die Zuordnung, statt sie zu ergänzen", async () => {
    const event = await makeEvent("Zahnarzt");
    await setEventMembers(db, event.id, [anna.id, bea.id]);
    await setEventMembers(db, event.id, [bea.id]);

    const byEvent = await memberIdsByEvent(db, [event.id]);
    assert.deepEqual(byEvent.get(event.id), [bea.id]);
  });

  it("entfernt alle Zuordnungen bei leerer Auswahl", async () => {
    const event = await makeEvent("Allgemein");
    await setEventMembers(db, event.id, [anna.id]);
    await setEventMembers(db, event.id, []);

    const byEvent = await memberIdsByEvent(db, [event.id]);
    assert.equal(byEvent.get(event.id), undefined);
  });

  it("ist bei wiederholtem Speichern derselben Auswahl stabil", async () => {
    const event = await makeEvent("Wiederholt");
    await setEventMembers(db, event.id, [anna.id]);
    await setEventMembers(db, event.id, [anna.id]);

    const byEvent = await memberIdsByEvent(db, [event.id]);
    assert.deepEqual(byEvent.get(event.id), [anna.id]);
  });

  it("entfernt doppelte und leere Kennungen aus der Eingabe", async () => {
    const event = await makeEvent("Doppelt");
    await setEventMembers(db, event.id, [anna.id, anna.id, "", "  "]);

    const byEvent = await memberIdsByEvent(db, [event.id]);
    assert.deepEqual(byEvent.get(event.id), [anna.id]);
  });

  it("reichert Termine um Name und Farbe an, nach Namen sortiert", async () => {
    const event = await makeEvent("Angereichert");
    await setEventMembers(db, event.id, [bea.id, anna.id]);

    const [enriched] = await attachMembersToEvents(db, [{ id: event.id, title: "x" }]);

    assert.deepEqual(
      enriched?.members.map((m) => m.displayName),
      ["Anna", "Bea"],
    );
    assert.equal(enriched?.members[0]?.colour, "#e11d48");
  });

  it("gibt für Termine ohne Zuordnung eine leere Liste zurück", async () => {
    const event = await makeEvent("Ohne Personen");
    const [enriched] = await attachMembersToEvents(db, [{ id: event.id }]);

    assert.deepEqual(enriched?.members, []);
  });

  it("kommt mit einer leeren Terminliste zurecht", async () => {
    assert.deepEqual(await attachMembersToEvents(db, []), []);
    assert.equal((await memberIdsByEvent(db, [])).size, 0);
  });

  it("findet die Termine eines Mitglieds", async () => {
    const solo = await members.createMember({ displayName: "Solo" });
    const event = await makeEvent("Nur Solo");
    await setEventMembers(db, event.id, [solo.id]);

    assert.deepEqual(await eventIdsForMember(db, solo.id), [event.id]);
  });

  it("räumt die Zuordnungen mit dem Termin ab", async () => {
    const event = await makeEvent("Wird geloescht");
    await setEventMembers(db, event.id, [anna.id]);
    await db.calendarEvent.delete({ where: { id: event.id } });

    const rest = await db.calendarEventMember.findMany({ where: { eventId: event.id } });
    assert.deepEqual(rest, []);
  });

  it("räumt die Zuordnungen mit dem Mitglied ab", async () => {
    const temp = await members.createMember({ displayName: "Temporaer" });
    const event = await makeEvent("Mit temporaerem Mitglied");
    await setEventMembers(db, event.id, [temp.id]);

    await members.removeMember(temp.id);

    const rest = await db.calendarEventMember.findMany({ where: { memberId: temp.id } });
    assert.deepEqual(rest, []);
  });
});
