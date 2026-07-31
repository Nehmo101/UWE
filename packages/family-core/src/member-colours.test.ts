import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FAMILY_MEMBER_COLOURS,
  FAMILY_MEMBER_FALLBACK_COLOUR,
  colourForMemberId,
  nextFreeMemberColour,
  normaliseMemberColour,
  readableTextColour,
  resolveMemberColour,
} from "./member-colours";

describe("normaliseMemberColour", () => {
  it("nimmt Hex mit und ohne Raute", () => {
    assert.equal(normaliseMemberColour("#E11D48"), "#e11d48");
    assert.equal(normaliseMemberColour("E11D48"), "#e11d48");
  });

  it("zieht die Kurzform auf sechs Stellen auf", () => {
    assert.equal(normaliseMemberColour("#abc"), "#aabbcc");
  });

  it("weist Unsinn zurück", () => {
    for (const value of ["", "   ", "rot", "#12345", "#gggggg", null, undefined, 42]) {
      assert.equal(normaliseMemberColour(value), null, `sollte null sein: ${String(value)}`);
    }
  });
});

describe("nextFreeMemberColour", () => {
  it("gibt die erste Palettenfarbe zurück, wenn nichts vergeben ist", () => {
    assert.equal(nextFreeMemberColour([]), FAMILY_MEMBER_COLOURS[0]);
  });

  it("überspringt vergebene Farben unabhängig von der Schreibweise", () => {
    assert.equal(nextFreeMemberColour(["#E11D48"]), FAMILY_MEMBER_COLOURS[1]);
  });

  it("fällt auf die Ersatzfarbe zurück, wenn die Palette erschöpft ist", () => {
    assert.equal(nextFreeMemberColour(FAMILY_MEMBER_COLOURS), FAMILY_MEMBER_FALLBACK_COLOUR);
  });

  it("ignoriert ungültige Einträge in der Belegung", () => {
    assert.equal(nextFreeMemberColour(["", "rot", "  "]), FAMILY_MEMBER_COLOURS[0]);
  });
});

describe("colourForMemberId", () => {
  it("ist stabil für dieselbe Kennung", () => {
    assert.equal(colourForMemberId("abc123"), colourForMemberId("abc123"));
  });

  it("liefert immer eine Farbe aus der Palette", () => {
    for (const id of ["a", "bb", "ccc", "cm9abc", ""]) {
      assert.ok(
        FAMILY_MEMBER_COLOURS.includes(colourForMemberId(id)),
        `ausserhalb der Palette: ${id}`,
      );
    }
  });
});

describe("resolveMemberColour", () => {
  it("bevorzugt die gespeicherte Farbe", () => {
    assert.equal(resolveMemberColour({ id: "m1", colour: "#2563EB" }), "#2563eb");
  });

  it("weicht ohne gespeicherte Farbe auf die Kennung aus", () => {
    const resolved = resolveMemberColour({ id: "m1", colour: "" });
    assert.ok(FAMILY_MEMBER_COLOURS.includes(resolved));
  });
});

describe("readableTextColour", () => {
  it("setzt dunkle Schrift auf helle Flächen", () => {
    assert.equal(readableTextColour("#ffffff"), "#111827");
  });

  it("setzt helle Schrift auf dunkle Flächen", () => {
    assert.equal(readableTextColour("#111827"), "#ffffff");
  });

  it("liefert für jede Palettenfarbe eine der beiden Schriftfarben", () => {
    for (const colour of FAMILY_MEMBER_COLOURS) {
      assert.ok(["#ffffff", "#111827"].includes(readableTextColour(colour)));
    }
  });
});
