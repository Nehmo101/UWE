import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDocumentTree, countNodes, flattenTree, normalizeBodyHeadings } from "./doc-tree";

/** Ausschnitt in der Gestalt von „Himmelsrouten": Titel, dann Teile auf derselben Ebene. */
const CAMPAIGN = `# HIMMELSROUTEN

*Drei Monate nach dem Massaker von Ferlor liegt die Große Straße in Trümmern.*

---

# KAPITEL 1: EINFÜHRUNG FÜR DIE SPIELLEITUNG

## 1.1 Worum es geht

Vor drei Monaten starb ein Dorf.

## 1.2 Die drei Akte im Überblick

**Akt I: Neue Wege (Stufe 3–5).** Goldrausch.

# AKT I: NEUE WEGE

## Szene 1: Feuer im Dock

Es brennt.
`;

describe("buildDocumentTree", () => {
  it("nests headings and numbers the siblings", () => {
    const tree = buildDocumentTree(CAMPAIGN);

    assert.equal(tree.nodes.length, 3);
    assert.deepEqual(
      tree.nodes.map((node) => node.title),
      ["HIMMELSROUTEN", "KAPITEL 1: EINFÜHRUNG FÜR DIE SPIELLEITUNG", "AKT I: NEUE WEGE"],
    );

    const chapter = tree.nodes[1];
    assert.deepEqual(
      chapter.children.map((child) => [child.title, child.sortIndex]),
      [
        ["1.1 Worum es geht", 0],
        ["1.2 Die drei Akte im Überblick", 1],
      ],
    );
  });

  it("keeps the text before the first heading as the preamble", () => {
    const tree = buildDocumentTree(CAMPAIGN);
    assert.equal(tree.preamble, "");

    const withPreamble = buildDocumentTree("Ein Vorspann.\n\n# Titel\n\nText.");
    assert.equal(withPreamble.preamble, "Ein Vorspann.");
  });

  it("folds sections deeper than maxDepth back into the body", () => {
    const source = "# A\n\n## B\n\n### C\n\nTiefer Text.\n";

    const deep = buildDocumentTree(source, { maxDepth: 3 });
    assert.equal(countNodes(deep.nodes), 3);

    const shallow = buildDocumentTree(source, { maxDepth: 2 });
    assert.equal(countNodes(shallow.nodes), 2);
    // Die eingefaltete Überschrift bleibt als Markdown erhalten, nur normalisiert.
    assert.match(flattenTree(shallow.nodes)[1].body, /^## C/m);
    assert.ok(flattenTree(shallow.nodes)[1].body.includes("Tiefer Text."));
  });

  it("strips the --- separators that sit between chapters", () => {
    const tree = buildDocumentTree(CAMPAIGN);
    assert.ok(!tree.nodes[0].body.includes("---"));
    assert.ok(tree.nodes[0].body.includes("Drei Monate nach dem Massaker"));
  });

  it("survives a level jump from # straight to ###", () => {
    const tree = buildDocumentTree("# A\n\n### C\n\nText.");

    assert.equal(tree.nodes.length, 1);
    assert.equal(tree.nodes[0].children.length, 1);
    assert.equal(tree.nodes[0].children[0].title, "C");
  });

  it("does not read a # inside a code fence as a heading", () => {
    const tree = buildDocumentTree("# A\n\n```bash\n# kein Titel\n```\n\nText.");

    assert.equal(countNodes(tree.nodes), 1);
    assert.ok(tree.nodes[0].body.includes("# kein Titel"));
  });

  it("picks up the canon markers from headings", () => {
    const tree = buildDocumentTree("# TERRA\n\n## 4.3 Vel-Sharaun ◆\n\nText.\n\n## 2.3 Zeitleiste ◇\n\nText.");
    const [canon, proposal] = tree.nodes[0].children;

    assert.equal(canon.title, "4.3 Vel-Sharaun");
    assert.equal(canon.marker, "canon");
    assert.equal(proposal.title, "2.3 Zeitleiste");
    assert.equal(proposal.marker, "proposal");
  });

  it("handles a document without any heading", () => {
    const tree = buildDocumentTree("Nur Text, keine Überschrift.");

    assert.equal(tree.nodes.length, 0);
    assert.equal(tree.preamble, "Nur Text, keine Überschrift.");
  });
});

describe("buildDocumentTree — Titelblock", () => {
  it("pulls subtitle headings into the root instead of making empty pages", () => {
    // Die Gestalt von „Der Magister-Turm von Validori".
    const tree = buildDocumentTree(
      [
        "# DER MAGISTER-TURM VON VALIDORI",
        "### Ein Dungeon für FTKJ · Stufe 8",
        "### Arkaner Seuchenturm auf einer Wurzelplattform",
        "---",
        "## TEIL A",
        "Text.",
      ].join("\n\n"),
    );

    const root = tree.nodes[0];
    assert.deepEqual(
      root.children.map((child) => child.title),
      ["TEIL A"],
    );
    assert.ok(root.body.includes("**Ein Dungeon für FTKJ · Stufe 8**"));
    assert.ok(root.body.includes("**Arkaner Seuchenturm auf einer Wurzelplattform**"));
  });

  it("leaves a lone child alone when it carries text — that may be a real section", () => {
    const tree = buildDocumentTree("# HIMMELSROUTEN\n\n## Sturm über Aernis\n\nDrei Monate danach.");

    assert.equal(tree.nodes[0].children.length, 1);
    assert.equal(tree.nodes[0].children[0].title, "Sturm über Aernis");
  });

  it("leaves a heading with sub-pages alone even when it has no text of its own", () => {
    const tree = buildDocumentTree("# Buch\n\n## Teil A\n\n### Kapitel 1\n\nText.");

    assert.equal(tree.nodes[0].children[0].title, "Teil A");
    assert.equal(tree.nodes[0].children[0].children.length, 1);
  });

  it("can be switched off", () => {
    const tree = buildDocumentTree("# A\n\n### Untertitel\n\n## B\n\nText.", {
      foldTitleBlock: false,
    });

    assert.deepEqual(
      tree.nodes[0].children.map((child) => child.title),
      ["Untertitel", "B"],
    );
  });
});

describe("buildDocumentTree — Inhaltsverzeichnis", () => {
  it("drops a table of contents that has no sub-pages", () => {
    const tree = buildDocumentTree("# Buch\n\n## INHALTSVERZEICHNIS\n\n- Kapitel 1\n\n## Kapitel 1\n\nText.");

    assert.deepEqual(
      tree.nodes[0].children.map((child) => [child.title, child.sortIndex]),
      [["Kapitel 1", 0]],
    );
  });

  it("keeps a section that only happens to be called Inhalt but has sub-pages", () => {
    const tree = buildDocumentTree("# Buch\n\n## Inhalt\n\n### Teil A\n\nText.");

    assert.equal(tree.nodes[0].children[0].title, "Inhalt");
  });

  it("can be switched off", () => {
    const tree = buildDocumentTree("# Buch\n\n## INHALT\n\n- a", { skipTableOfContents: false });
    assert.equal(tree.nodes[0].children[0].title, "INHALT");
  });
});

describe("normalizeBodyHeadings", () => {
  it("lifts the shallowest body heading to ##", () => {
    assert.equal(normalizeBodyHeadings("#### Tief\n\nText\n\n##### Tiefer"), "## Tief\n\nText\n\n### Tiefer");
  });

  it("leaves a body that already starts at ## alone", () => {
    const body = "## Schon richtig\n\nText";
    assert.equal(normalizeBodyHeadings(body), body);
  });

  it("leaves a body without headings alone", () => {
    assert.equal(normalizeBodyHeadings("Nur Text."), "Nur Text.");
  });

  it("never pushes a heading past h6", () => {
    assert.equal(normalizeBodyHeadings("# Eins\n\n###### Sechs"), "## Eins\n\n###### Sechs");
  });
});

describe("flattenTree", () => {
  it("returns parents before their children, in document order", () => {
    const tree = buildDocumentTree(CAMPAIGN);

    assert.deepEqual(
      flattenTree(tree.nodes).map((node) => node.title),
      [
        "HIMMELSROUTEN",
        "KAPITEL 1: EINFÜHRUNG FÜR DIE SPIELLEITUNG",
        "1.1 Worum es geht",
        "1.2 Die drei Akte im Überblick",
        "AKT I: NEUE WEGE",
        "Szene 1: Feuer im Dock",
      ],
    );
  });
});
