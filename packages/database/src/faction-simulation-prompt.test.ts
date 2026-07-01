import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFactionSimulationPrompt,
  summarizeFactionStateForUi,
} from "./faction-simulation-prompt";

describe("buildFactionSimulationPrompt", () => {
  it("includes calendar date and faction state", () => {
    const prompt = buildFactionSimulationPrompt({
      pageTitle: "Gilde der Magier",
      currentDateLabel: "5. Frühling 1024",
      currentDate: { year: 1024, month: 1, day: 5 },
      calendarName: "Terra-Kalender",
      factionState: {
        agenda: "Handelsmonopol sichern",
        powerLevel: 7,
        goals: [{ title: "Turm ausbauen" }],
        resources: { gold: 500 },
        relationships: { rivals: ["Schattengarde"] },
        notes: "Vorsichtig gegenüber Adel",
      },
      structuredInput: {
        timeSkipDays: "30",
        scenarioNote: "Spannung mit rivalisierender Fraktion eskaliert",
      },
    });

    assert.match(prompt, /Gilde der Magier/);
    assert.match(prompt, /5\. Frühling 1024/);
    assert.match(prompt, /Terra-Kalender/);
    assert.match(prompt, /Handelsmonopol sichern/);
    assert.match(prompt, /Machtstufe: 7\/10/);
    assert.match(prompt, /ca\. 30 In-Game-Tage/);
    assert.match(prompt, /Spannung mit rivalisierender Fraktion eskaliert/);
    assert.match(prompt, /"events":\[/);
  });

  it("handles missing faction state", () => {
    const prompt = buildFactionSimulationPrompt({
      pageTitle: "Unbekannte Fraktion",
      currentDateLabel: "1. Frühling 1",
      currentDate: { year: 1, month: 1, day: 1 },
    });

    assert.match(prompt, /Kein strukturierter Fraktions-State/);
  });
});

describe("summarizeFactionStateForUi", () => {
  it("returns hint when state is missing", () => {
    const lines = summarizeFactionStateForUi(null);
    assert.equal(lines.length, 1);
    assert.match(lines[0]!, /Noch kein Fraktions-State/);
  });
});
