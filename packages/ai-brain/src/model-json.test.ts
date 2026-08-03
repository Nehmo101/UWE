import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildJsonRepairPrompt,
  extractJsonObjectText,
  generateWithJsonRepair,
  parseModelJson,
  readModelJson,
  stripCodeFence,
} from "./model-json";

/**
 * The cases here are not invented — they are what small local models actually
 * return when told "Antworte NUR als JSON". Each one used to cost a run.
 */
describe("parseModelJson — what models really send back", () => {
  it("takes a clean object unchanged and marks it unrepaired", () => {
    const result = parseModelJson('{"tags":["wald","norden"]}');
    assert.equal(result.ok, true);
    assert.deepEqual(result.ok && result.value, { tags: ["wald", "norden"] });
    assert.equal(result.ok && result.repaired, false);
  });

  it("strips a ```json fence", () => {
    const result = parseModelJson('```json\n{"biom":"kueste"}\n```');
    assert.equal(result.ok, true);
    assert.deepEqual(result.ok && result.value, { biom: "kueste" });
    assert.equal(result.ok && result.repaired, true);
  });

  it("strips a bare fence", () => {
    assert.deepEqual(readModelJson('```\n{"a":1}\n```'), { a: 1 });
  });

  it("cuts away a preamble", () => {
    assert.deepEqual(
      readModelJson('Hier ist das JSON, das du wolltest:\n{"siedlungen":3}'),
      { siedlungen: 3 },
    );
  });

  it("cuts away a postamble — the case the old first-brace/last-brace reader lost", () => {
    /* The old implementation took `indexOf("{")` to `lastIndexOf("}")`, so this
       answer produced `{"a":1}\n\nViel Spaß! (und {noch was})` and failed to
       parse. A balanced scan stops at the matching brace. */
    const raw = '{"a":1}\n\nViel Spaß damit! (und {noch was})';
    assert.deepEqual(readModelJson(raw), { a: 1 });
  });

  it("keeps braces that live inside strings", () => {
    assert.deepEqual(readModelJson('{"notiz":"ein } in Anfuehrungszeichen"}'), {
      notiz: "ein } in Anfuehrungszeichen",
    });
  });

  it("survives an escaped quote before a brace", () => {
    assert.deepEqual(readModelJson('{"notiz":"sagte \\"halt}\\" laut"}'), {
      notiz: 'sagte "halt}" laut',
    });
  });

  it("reads the object out of a fence that also carries prose", () => {
    const raw = 'Kurz erklärt:\n```json\nAchtung: {"kartenGroesse":512}\n```\nFertig.';
    assert.deepEqual(readModelJson(raw), { kartenGroesse: 512 });
  });

  it("names a truncated answer as truncated, not as prose", () => {
    const result = parseModelJson('{"namen":{"orte":["Möwenfurt",');
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.reason, "unterminated");
  });

  it("names a prose answer as prose", () => {
    const result = parseModelJson("Gerne! Die Karte sollte eine raue Küste zeigen.");
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.reason, "no_object");
  });

  it("rejects a bare array — every UWE JSON contract is an object", () => {
    const result = parseModelJson('["wald","norden"]');
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.reason, "not_an_object");
  });

  it("rejects an empty answer", () => {
    assert.equal(parseModelJson("   \n  ").ok, false);
    assert.equal(parseModelJson("").ok, false);
  });

  it("reports broken syntax as broken syntax", () => {
    const result = parseModelJson('{"a":1,}');
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.reason, "invalid_json");
  });

  it("does not try to repair the JSON itself", () => {
    // A trailing comma, a single-quoted key, an unquoted value — all things a
    // "smart" repairer would guess at. Guessing manufactures a silently wrong
    // answer; failing hands the case to the retry and then to the validators.
    for (const broken of ["{'a':1}", "{a:1}", '{"a":1 "b":2}']) {
      assert.equal(parseModelJson(broken).ok, false, broken);
    }
  });
});

describe("extractJsonObjectText / stripCodeFence", () => {
  it("returns null when there is no brace at all", () => {
    assert.equal(extractJsonObjectText("nur Text"), null);
  });

  it("returns null for an unbalanced block", () => {
    assert.equal(extractJsonObjectText('{"a":{"b":1}'), null);
  });

  it("ignores a fence that announces another language", () => {
    assert.equal(stripCodeFence('```python\nprint(1)\n```'), null);
  });
});

describe("buildJsonRepairPrompt", () => {
  const failure = parseModelJson("kein JSON hier");

  it("carries the original task, the reason and a bounded echo", () => {
    assert.equal(failure.ok, false);
    if (failure.ok) return;
    const prompt = buildJsonRepairPrompt("Aufgabe: Tags vorschlagen", "kein JSON hier", failure);

    assert.ok(prompt.startsWith("Aufgabe: Tags vorschlagen"), "original task comes first");
    assert.ok(prompt.includes(failure.message), "the reason is stated");
    assert.ok(prompt.includes("kein JSON hier"), "the bad answer is echoed");
    assert.ok(prompt.includes("{"), "the required shape is spelled out");
  });

  it("truncates a runaway answer instead of resending all of it", () => {
    if (failure.ok) return;
    const runaway = "x".repeat(50_000);
    const prompt = buildJsonRepairPrompt("Aufgabe", runaway, failure);
    assert.ok(prompt.length < 2_000, `repair prompt grew to ${prompt.length} characters`);
  });
});

/** Counts calls so "at most one retry" is measured, not assumed. */
function recorder(answers: string[]) {
  const prompts: string[] = [];
  let index = 0;
  return {
    prompts,
    get calls() {
      return prompts.length;
    },
    generate: async (prompt: string) => {
      prompts.push(prompt);
      const text = answers[Math.min(index, answers.length - 1)] ?? "";
      index++;
      return { text, model: "m", provider: "ollama" as const };
    },
  };
}

describe("generateWithJsonRepair — bounded at exactly one retry", () => {
  it("does not call twice when the first answer is already JSON", async () => {
    const rec = recorder(['{"a":1}']);
    const outcome = await generateWithJsonRepair({
      wantsJson: true,
      prompt: "Aufgabe",
      generate: rec.generate,
    });

    assert.equal(rec.calls, 1);
    assert.equal(outcome.repairAttempted, false);
    assert.equal(outcome.ok, true);
  });

  it("never calls twice when the task does not want JSON", async () => {
    const rec = recorder(["Eine schöne Zusammenfassung ohne jedes JSON."]);
    const outcome = await generateWithJsonRepair({
      wantsJson: false,
      prompt: "Aufgabe",
      generate: rec.generate,
    });

    assert.equal(rec.calls, 1);
    assert.equal(outcome.repairAttempted, false);
    assert.equal(outcome.ok, true, "prose tasks are never judged by the JSON parser");
  });

  it("retries once with the error in the prompt and takes the repaired answer", async () => {
    const rec = recorder(["Klar! Hier die Tags: Wald, Norden.", '{"tags":["wald"]}']);
    const outcome = await generateWithJsonRepair({
      wantsJson: true,
      prompt: "Aufgabe: Tags vorschlagen",
      generate: rec.generate,
    });

    assert.equal(rec.calls, 2);
    assert.equal(outcome.repairAttempted, true);
    assert.equal(outcome.ok, true);
    assert.equal(outcome.result.text, '{"tags":["wald"]}');

    assert.equal(rec.prompts[0], "Aufgabe: Tags vorschlagen");
    assert.ok(rec.prompts[1]?.startsWith("Aufgabe: Tags vorschlagen"), "task is repeated");
    assert.ok(rec.prompts[1]?.includes("KORREKTUR"), "the retry says what went wrong");
  });

  it("stops after the second failure — no third call, no loop", async () => {
    // Both answers are prose. This is the case a naive `while (!ok) retry()`
    // would spin on forever while the user waits.
    const rec = recorder(["Erste Ausrede.", "Zweite Ausrede."]);
    const outcome = await generateWithJsonRepair({
      wantsJson: true,
      prompt: "Aufgabe",
      generate: rec.generate,
    });

    assert.equal(rec.calls, 2, "at most two calls, ever");
    assert.equal(outcome.repairAttempted, true);
    assert.equal(outcome.ok, false);
    // The FIRST answer survives: the second is usually an apology, the first at
    // least carries what the model meant. The validators clamp from here.
    assert.equal(outcome.result.text, "Erste Ausrede.");
  });

  it("repairs a fenced answer without a second call", async () => {
    const rec = recorder(['```json\n{"a":1}\n```']);
    const outcome = await generateWithJsonRepair({
      wantsJson: true,
      prompt: "Aufgabe",
      generate: rec.generate,
    });

    assert.equal(rec.calls, 1, "stripping a fence is free — it must not cost a round trip");
    assert.equal(outcome.ok, true);
  });

  /* Ohne den Fix stehen in der Info-Zeile zwei Sternquantoren ueber derselben
     Zeichenmenge nebeneinander, und die Laufzeit waechst quadratisch mit der
     Zahl der Leerzeichen. Gemessen: 8000 Zeichen brauchten rund 77 ms, 16000
     schon ueber eine Sekunde. Die Schranke ist grosszuegig, damit langsame
     CI-Runner nicht flackern — quadratisches Verhalten reisst sie trotzdem. */
  it("bricht bei einer Fence-Zeile aus lauter Leerzeichen nicht ein", () => {
    const hostile = "```" + " ".repeat(50_000);
    const started = Date.now();
    assert.equal(stripCodeFence(hostile), null);
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 1000, `stripCodeFence brauchte ${elapsed} ms — erwartet linear`);
  });

  it("liest die Fence-Varianten unveraendert", () => {
    assert.equal(stripCodeFence('```json\n{"a":1}\n```'), '{"a":1}');
    assert.equal(stripCodeFence('```JSON\n{"a":1}\n```'), '{"a":1}');
    assert.equal(stripCodeFence('```  json  \n{"a":1}\n```'), '{"a":1}');
    assert.equal(stripCodeFence('```\n{"a":1}\n```'), '{"a":1}');
    assert.equal(stripCodeFence('```json\r\n{"a":1}\r\n```'), '{"a":1}');
  });
});
