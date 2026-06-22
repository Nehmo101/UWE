import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseImportContent } from "../registry";
import {
  parseMarkdownBundle,
  parseMarkdownDocument,
  splitMarkdownDocuments,
} from "./markdown-parse";

describe("Markdown import parser", () => {
  it("splits frontmatter documents without breaking on inner --- markers", () => {
    const chunks = splitMarkdownDocuments(`---
title: Erster
---

Inhalt eins

---

---
title: Zweiter
---

Inhalt zwei`);

    assert.equal(chunks.length, 2);
    assert.match(chunks[0] ?? "", /title: Erster/);
    assert.match(chunks[1] ?? "", /title: Zweiter/);
  });

  it("parses frontmatter and body", () => {
    const document = parseMarkdownDocument(`---
title: Die Verlorene Mine
type: dungeon
tags: mine, zwerg
---

# Eingang

Eine alte Zwergenmine.`);

    assert.equal(document.title, "Die Verlorene Mine");
    assert.equal(document.frontmatter.type, "dungeon");
    assert.match(document.body, /Eine alte Zwergenmine/);
  });

  it("derives title from first heading when frontmatter is missing", () => {
    const document = parseMarkdownDocument(`# Hafenstadt Valoris

Die Stadt am Meer.`);

    assert.equal(document.title, "Hafenstadt Valoris");
    assert.match(document.body, /Die Stadt am Meer/);
  });

  it("maps multiple unstructured texts to import entities", () => {
    const entities = parseMarkdownBundle(`# NPC A

Ein Händler.

---

# NPC B

Ein Wächter.`);

    assert.equal(entities.length, 2);
    assert.equal(entities[0]?.title, "NPC A");
    assert.equal(entities[1]?.title, "NPC B");
    assert.equal(entities[0]?.type, "wissenstext");
    assert.match(entities[0]?.content ?? "", /Ein Händler/);
  });

  it("is available through the import registry", () => {
    const { bundle, validationErrors } = parseImportContent(
      "markdown",
      `---
title: Lore-Fragment
---

Unstrukturierter Text.`,
    );

    assert.equal(validationErrors.length, 0);
    assert.equal(bundle.entities.length, 1);
    assert.equal(bundle.entities[0]?.title, "Lore-Fragment");
  });
});
