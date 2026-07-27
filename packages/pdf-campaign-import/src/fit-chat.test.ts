import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCampaignFitChatPrompt,
  MAX_FIT_CHAT_ENTITY_LINES,
  MAX_FIT_CHAT_MESSAGE_CHARS,
  MAX_FIT_CHAT_MESSAGES,
  sanitizeFitChatTranscript,
  type CampaignFitChatContext,
} from "./fit-chat";

const BASE_CONTEXT: CampaignFitChatContext = {
  worldName: "Validor",
  worldDescription: "Ein zersplittertes Kaiserreich nach dem Thronfolgekrieg.",
  campaignName: "Schatten über dem Norden",
  campaignDescription: null,
  campaignContext: "Die Kampagne spielt im Norden Validors.",
  entities: [
    { kind: "npc", title: "Magister Halvar", summary: "Hofmagier mit Geheimnis" },
    { kind: "location", title: "Feste Grimmwacht", summary: null },
  ],
};

test("sanitizeFitChatTranscript drops invalid entries and keeps order", () => {
  const transcript = sanitizeFitChatTranscript([
    { role: "user", content: "  Wie passt Halvar zu meinem Hof?  " },
    { role: "system", content: "ignorieren" },
    { role: "assistant", content: "" },
    "kaputt",
    { role: "assistant", content: "Er könnte ein Rivale des Hofmagiers sein." },
  ]);

  assert.deepEqual(transcript, [
    { role: "user", content: "Wie passt Halvar zu meinem Hof?" },
    { role: "assistant", content: "Er könnte ein Rivale des Hofmagiers sein." },
  ]);
});

test("sanitizeFitChatTranscript caps message length and message count", () => {
  const long = "x".repeat(MAX_FIT_CHAT_MESSAGE_CHARS + 500);
  const many = Array.from({ length: MAX_FIT_CHAT_MESSAGES + 5 }, (_v, index) => ({
    role: "user" as const,
    content: `Nachricht ${index}` + (index === 0 ? long : ""),
  }));

  const transcript = sanitizeFitChatTranscript([{ role: "user", content: long }, ...many]);

  assert.equal(transcript.length, MAX_FIT_CHAT_MESSAGES);
  assert.ok(transcript.every((message) => message.content.length <= MAX_FIT_CHAT_MESSAGE_CHARS));
  assert.equal(transcript.at(-1)?.content, `Nachricht ${MAX_FIT_CHAT_MESSAGES + 4}`);
});

test("buildCampaignFitChatPrompt embeds world, campaign, entities and transcript", () => {
  const prompt = buildCampaignFitChatPrompt(BASE_CONTEXT, [
    { role: "user", content: "Wie passt die Feste in meine Grenzregion?" },
  ]);

  assert.match(prompt, /Welt: Validor/);
  assert.match(prompt, /zersplittertes Kaiserreich/);
  assert.match(prompt, /Kampagne: Schatten über dem Norden/);
  assert.match(prompt, /Vom Spielleiter angegebener Kampagnen-Kontext:/);
  assert.match(prompt, /\[npc\] Magister Halvar — Hofmagier mit Geheimnis/);
  assert.match(prompt, /\[location\] Feste Grimmwacht/);
  assert.match(prompt, /Spielleiter: Wie passt die Feste in meine Grenzregion\?/);
  assert.match(prompt, /ohne JSON/);
});

test("buildCampaignFitChatPrompt notes missing entities and caps long lists", () => {
  const emptyPrompt = buildCampaignFitChatPrompt({ ...BASE_CONTEXT, entities: [] }, []);
  assert.match(emptyPrompt, /Noch keine Entitäten extrahiert/);

  const entities = Array.from({ length: MAX_FIT_CHAT_ENTITY_LINES + 7 }, (_v, index) => ({
    kind: "note" as const,
    title: `Eintrag ${index}`,
    summary: null,
  }));
  const cappedPrompt = buildCampaignFitChatPrompt({ ...BASE_CONTEXT, entities }, []);
  assert.match(cappedPrompt, /… und 7 weitere Entitäten\./);
});
