import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wikiCss = readFileSync(path.join(__dirname, "../app/wiki.css"), "utf8");
const controlsSource = readFileSync(
  path.join(__dirname, "../components/AiPromptControls.tsx"),
  "utf8",
);
const mobilePanelSource = readFileSync(
  path.join(__dirname, "../components/MobileAiPromptPanel.tsx"),
  "utf8",
);

describe("AiPromptControls — mobile UI structure", () => {
  it("defines accessible segment groups for provider and context", () => {
    assert.match(controlsSource, /role="radiogroup"/);
    assert.match(controlsSource, /legend="KI-Modus"/);
    assert.match(controlsSource, /legend="Kontext"/);
    assert.match(controlsSource, /mobile-ai-segment/);
    assert.match(controlsSource, /deriveStatusChips/);
  });

  it("shows privacy hints from computePromptUiState", () => {
    assert.match(controlsSource, /mobile-ai-hints/);
    assert.match(controlsSource, /computePromptUiState/);
    assert.match(controlsSource, /aria-live="polite"/);
  });

  it("disables segment options via ui contextOptions disabled flag", () => {
    assert.match(controlsSource, /option\.disabled/);
    assert.match(controlsSource, /disabledReason/);
    assert.match(controlsSource, /mobile-ai-segment-disabled/);
  });
});

describe("MobileAiPromptPanel — security and layout", () => {
  it("does not reference RTX agent tokens in component source", () => {
    assert.doesNotMatch(mobilePanelSource, /RTX_AGENT_TOKEN|AGENT_TOKEN|process\.env\.RTX/i);
  });

  it("uses sticky send bar and large textarea for mobile prompting", () => {
    assert.match(mobilePanelSource, /StickyActionBar/);
    assert.match(mobilePanelSource, /mobile-ai-prompt-input/);
    assert.match(mobilePanelSource, /mobile-ai-send-btn/);
    assert.match(mobilePanelSource, /rows=\{6\}/);
  });
});

describe("Mobile KI CSS — touch-friendly layout", () => {
  it("defines large prompt input and segment controls for mobile", () => {
    assert.match(wikiCss, /\.mobile-ai-prompt-input/);
    assert.match(wikiCss, /min-height:\s*9rem/);
    assert.match(wikiCss, /\.mobile-ai-segment/);
    assert.match(wikiCss, /min-height:\s*2\.75rem/);
  });

  it("hides duplicate desktop send button on small screens", () => {
    assert.match(wikiCss, /\.mobile-ai-send-desktop/);
    assert.match(wikiCss, /display:\s*none/);
  });

  it("uses sticky action bar padding on mobile prompt panel", () => {
    assert.match(wikiCss, /\.mobile-ai-prompt\.uwe-has-sticky-actions/);
    assert.match(wikiCss, /padding-bottom/);
  });
});
