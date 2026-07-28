import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCampaignExtractionPrompt,
  MAX_CAMPAIGN_CONTEXT_CHARACTERS,
} from "./prompt";

test("buildCampaignExtractionPrompt embeds user-provided campaign context", () => {
  const prompt = buildCampaignExtractionPrompt(
    "PDF content",
    "The borderlands belong to the realm of Validor.",
  );

  assert.match(prompt, /<campaign_context>/);
  assert.match(prompt, /The borderlands belong to the realm of Validor\./);
  assert.match(prompt, /nur zur Einordnung/);
  assert.match(prompt, /PDF-Ausschnitt:\nPDF content$/);
});

test("buildCampaignExtractionPrompt omits an empty context section", () => {
  const prompt = buildCampaignExtractionPrompt("PDF content", "   ");

  assert.doesNotMatch(prompt, /campaign_context/);
});

test("campaign context limit allows extensive world briefings", () => {
  assert.equal(MAX_CAMPAIGN_CONTEXT_CHARACTERS, 32_000);
});
