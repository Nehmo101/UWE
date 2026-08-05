import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAccessContext } from "./permissions";
import {
  canCreateTerraKarte,
  canDeleteTerraKarte,
  canEditTerraKarte,
  canSubmitTerraKarte,
  canViewTerraKarte,
  canWithdrawTerraKarte,
  type TerraKarteAccessInfo,
} from "./terra-karte-permissions";
import type { AreaAccess, AuthUser } from "./types";

/**
 * Terra-Karten aus dem Portal (J5).
 *
 * Der Fall, an dem hier alles hängt: das Studio-Häkchen lässt `canReadWorld`
 * immer durch, damit die Spielervorschau funktioniert. Wer daraus auf ein
 * Schreibrecht schliesst, gibt jedem mit Studio-Häkchen Baurechte in JEDER
 * Welt — auch in denen, denen er nie zugeordnet wurde. Deshalb prüft
 * `canCreateTerraKarte` die Welt-ZUORDNUNG und nicht die Lesbarkeit.
 */

function access(partial: Partial<AreaAccess> = {}): AreaAccess {
  return { portal: false, studio: false, brain: false, family: false, ...partial };
}

function user(id: string, overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id,
    displayName: id,
    email: `${id}@test`,
    isOwner: false,
    access: access({ portal: true }),
    aiAccess: false,
    ...overrides,
  };
}

/** Spieler A — der Welt zugeordnet. */
const spielerA = buildAccessContext({
  user: user("spieler-a"),
  worldMembership: { userId: "spieler-a", worldId: "w1", characterName: "Thalia" },
});

/** Spieler B — derselben Welt zugeordnet, aber nicht der Autor. */
const spielerB = buildAccessContext({
  user: user("spieler-b"),
  worldMembership: { userId: "spieler-b", worldId: "w1", characterName: "Bran" },
});

/** Studio-Häkchen, aber KEINE Zuordnung zu dieser Welt. */
const nurHaekchen = buildAccessContext({
  user: user("dm-1", { access: access({ portal: true, studio: true }) }),
  worldMembership: null,
});

/** Spielleiter, der sich das Portal als Spieler ansieht. */
const vorschau = buildAccessContext({
  user: user("dm-1", { access: access({ portal: true, studio: true }) }),
  worldMembership: { userId: "dm-1", worldId: "w1", characterName: null },
  preview: { previewAsUserId: "spieler-a" },
});

/** Niemand angemeldet. */
const gast = buildAccessContext({ user: null, worldMembership: null });

function karte(partial: Partial<TerraKarteAccessInfo> = {}): TerraKarteAccessInfo {
  return { autorUserId: "spieler-a", status: "entwurf", ...partial };
}

describe("canCreateTerraKarte", () => {
  it("wer der Welt zugeordnet ist, darf darin bauen", () => {
    assert.equal(canCreateTerraKarte(spielerA), true);
    assert.equal(canCreateTerraKarte(spielerB), true);
  });

  it("ein Häkchen ohne Welt-Zuordnung reicht nicht", () => {
    assert.equal(canCreateTerraKarte(nurHaekchen), false);
  });

  it("in der Spielervorschau wird nicht gebaut", () => {
    assert.equal(canCreateTerraKarte(vorschau), false);
  });

  it("ohne Anmeldung gar nichts", () => {
    assert.equal(canCreateTerraKarte(gast), false);
  });
});

describe("canViewTerraKarte", () => {
  it("Abgenommenes sieht jeder, der die Welt lesen darf", () => {
    const abgenommen = karte({ status: "freigegeben" });
    assert.equal(canViewTerraKarte(spielerB, abgenommen), true);
    assert.equal(canViewTerraKarte(gast, abgenommen), true);
  });

  it("einen Entwurf sieht nur sein Autor", () => {
    assert.equal(canViewTerraKarte(spielerA, karte()), true);
    assert.equal(canViewTerraKarte(spielerB, karte()), false);
    assert.equal(canViewTerraKarte(gast, karte()), false);
  });

  it("das gilt auch für das Eingereichte — es liegt beim Spielleiter", () => {
    const eingereicht = karte({ status: "eingereicht" });
    assert.equal(canViewTerraKarte(spielerA, eingereicht), true);
    assert.equal(canViewTerraKarte(spielerB, eingereicht), false);
  });
});

describe("canEditTerraKarte", () => {
  it("der Autor bearbeitet seinen Entwurf", () => {
    assert.equal(canEditTerraKarte(spielerA, karte()), true);
  });

  it("ein anderer Spieler nicht", () => {
    assert.equal(canEditTerraKarte(spielerB, karte()), false);
  });

  it("nach dem Einreichen und nach der Abnahme niemand mehr im Portal", () => {
    assert.equal(canEditTerraKarte(spielerA, karte({ status: "eingereicht" })), false);
    assert.equal(canEditTerraKarte(spielerA, karte({ status: "freigegeben" })), false);
  });

  it("eine Studio-Karte ohne Autor ist im Portal nie bearbeitbar", () => {
    assert.equal(canEditTerraKarte(spielerA, karte({ autorUserId: null })), false);
    assert.equal(
      canEditTerraKarte(spielerA, karte({ autorUserId: null, status: "freigegeben" })),
      false,
    );
  });
});

describe("canWithdrawTerraKarte und canDeleteTerraKarte", () => {
  it("zurückziehen darf der Autor nur das Eingereichte", () => {
    assert.equal(canWithdrawTerraKarte(spielerA, karte({ status: "eingereicht" })), true);
    assert.equal(canWithdrawTerraKarte(spielerA, karte({ status: "entwurf" })), false);
    assert.equal(canWithdrawTerraKarte(spielerB, karte({ status: "eingereicht" })), false);
  });

  it("löschen darf der Autor, solange nicht abgenommen ist", () => {
    assert.equal(canDeleteTerraKarte(spielerA, karte({ status: "entwurf" })), true);
    assert.equal(canDeleteTerraKarte(spielerA, karte({ status: "eingereicht" })), true);
    // Danach gehört die Karte der Welt — nur das Studio räumt Weltinhalt weg.
    assert.equal(canDeleteTerraKarte(spielerA, karte({ status: "freigegeben" })), false);
    assert.equal(canDeleteTerraKarte(spielerB, karte({ status: "entwurf" })), false);
  });

  it("Sperre des Spielleiters: gesperrte Karten sind im Portal nur noch lesbar", () => {
    const gesperrt = karte({ gesperrt: true });
    assert.equal(canEditTerraKarte(spielerA, gesperrt), false);
    assert.equal(canSubmitTerraKarte(spielerA, gesperrt), false);
    assert.equal(canWithdrawTerraKarte(spielerA, karte({ status: "eingereicht", gesperrt: true })), false);
    assert.equal(canDeleteTerraKarte(spielerA, gesperrt), false);
    // Ansehen bleibt: die Sperre nimmt den Stift, nicht die Karte.
    assert.equal(canViewTerraKarte(spielerA, gesperrt), true);
  });
});
