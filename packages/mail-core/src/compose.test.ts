import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  composeHandoutMail,
  composeSessionRecapMail,
  composeShareLinkMail,
} from "./compose";

describe("mail compose — player safety", () => {
  it("session recap uses player summary only, never DM summary", () => {
    const draft = composeSessionRecapMail({
      worldId: "w1",
      sessionId: "s1",
      sessionTitle: "Die Höhle",
      sessionNumber: 3,
      summaryPlayer: "Die Gruppe findet einen Schlüssel.",
      summaryDm: "Der Schlüssel öffnet das Versteck mit dem Artefakt.",
    });

    assert.match(draft.bodyText, /findet einen Schlüssel/);
    assert.ok(!draft.bodyText.includes("Artefakt"));
    assert.equal(draft.containsDmOnlyHint, false);
    assert.equal(draft.warnings.length, 0);
  });

  it("session recap warns when only DM summary exists", () => {
    const draft = composeSessionRecapMail({
      worldId: "w1",
      sessionId: "s1",
      sessionTitle: "Die Höhle",
      sessionNumber: 3,
      summaryPlayer: null,
      summaryDm: "Geheime DM-Notizen über den Artefakt.",
    });

    assert.equal(draft.containsDmOnlyHint, true);
    assert.ok(draft.warnings.some((w) => /DM-Zusammenfassung/i.test(w)));
    assert.ok(!draft.bodyText.includes("Geheime DM-Notizen"));
    assert.match(draft.bodyText, /Spieler-Recap noch nicht/i);
  });

  it("handout mail flags dm_only visibility", () => {
    const draft = composeHandoutMail({
      worldId: "w1",
      assetId: "a1",
      title: "Geheime Karte",
      description: "Nur für den DM.",
      visibility: "dm_only",
    });

    assert.equal(draft.containsDmOnlyHint, true);
    assert.ok(draft.warnings.some((w) => /DM-only/i.test(w)));
    assert.match(draft.bodyText, /Geheime Karte/);
  });

  it("share link compose does not mark dm_only hint", () => {
    const draft = composeShareLinkMail({
      worldId: "w1",
      shareLinkId: "sl1",
      targetLabel: "Kampagne Alpha",
      publicUrl: "https://uwe.example/preview/abc",
    });

    assert.equal(draft.containsDmOnlyHint, false);
    assert.match(draft.bodyText, /preview\/abc/);
  });
});
