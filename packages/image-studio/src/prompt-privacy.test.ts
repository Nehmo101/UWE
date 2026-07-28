import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assembleImageStudioPrompt,
  isLocalOnlyImageContext,
  scanPromptForPrivateDataLeak,
} from "./prompt-privacy";

describe("image studio prompt assembly", () => {
  it("hängt den Kontext an, wenn einer gewählt ist", () => {
    const result = assembleImageStudioPrompt({
      prompt: "A forest temple",
      contextMode: "brain_context",
      contextSnippet: "Der Tempel gehört den Grauen Wächtern",
    });
    assert.equal(result.contextIncluded, true);
    assert.match(result.prompt, /\[Kontext: Der Tempel gehört den Grauen Wächtern\]/);
  });

  it("lässt den Prompt in Ruhe, wenn kein Kontext gewählt ist", () => {
    const result = assembleImageStudioPrompt({
      prompt: "  A forest temple  ",
      contextMode: "prompt_only",
      contextSnippet: "wird ignoriert",
    });
    assert.equal(result.contextIncluded, false);
    assert.equal(result.prompt, "A forest temple");
  });

  it("kennt die Kontexte mit privaten Inhalten", () => {
    assert.equal(isLocalOnlyImageContext("brain_context"), true);
    assert.equal(isLocalOnlyImageContext("prompt_only"), false);
  });
});

describe("scanPromptForPrivateDataLeak", () => {
  it("meldet eingebettete Kontext-Blöcke und Brain-Referenzen", () => {
    assert.deepEqual(scanPromptForPrivateDataLeak("[Kontext: irgendwas]"), [
      "Eingebetteter Kontext-Block im Prompt",
    ]);
    assert.deepEqual(scanPromptForPrivateDataLeak("aus dem life-brain"), [
      "Brain/Welt-Referenz im Prompt",
    ]);
  });

  it("meldet nichts bei einem gewöhnlichen Prompt", () => {
    assert.deepEqual(scanPromptForPrivateDataLeak("Ein Drache über einem See"), []);
  });
});
