import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CircleHelp } from "lucide-react";
import { resolveLucideIcon } from "./icon";
import { studioNavItems } from "../../navigation/studio-nav";
import { worldNavItems } from "../../navigation/world-nav";

describe("lucide icon resolver", () => {
  it("maps kebab-case names to Lucide components", () => {
    assert.equal(typeof resolveLucideIcon("layout-dashboard"), "object");
    assert.notEqual(resolveLucideIcon("layout-dashboard"), CircleHelp);
    assert.notEqual(resolveLucideIcon("globe"), CircleHelp);
    assert.notEqual(resolveLucideIcon("book-open"), CircleHelp);
  });

  it("falls back to a help glyph for unknown names", () => {
    assert.equal(resolveLucideIcon("definitely-not-an-icon-xyz"), CircleHelp);
  });

  it("every Studio + world nav icon resolves to a real Lucide icon", () => {
    const items = [...studioNavItems(), ...worldNavItems("terra")];
    const unresolved = items
      .filter((item) => resolveLucideIcon(item.icon) === CircleHelp)
      .map((item) => `${item.id}: ${item.icon}`);
    assert.deepEqual(unresolved, [], `nav items with unknown icons: ${unresolved.join(", ")}`);
  });
});
