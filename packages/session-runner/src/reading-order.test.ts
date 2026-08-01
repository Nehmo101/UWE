import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAncestorTrail,
  buildReadingOrder,
  findChildren,
  findReadingNeighbours,
  findReadingRoot,
  type ReadingPage,
} from "./reading-order";

function page(
  id: string,
  parentPageId: string | null,
  sortIndex: number | null,
  title = id,
): ReadingPage {
  return { id, parentPageId, sortIndex, title, slug: id, type: "lore" };
}

/** Ein Kampagnenbuch in klein: Band → zwei Akte → Szenen. */
const BOOK: ReadingPage[] = [
  page("buch", null, null, "Himmelsrouten"),
  page("akt-1", "buch", 0, "Akt I"),
  page("szene-1", "akt-1", 0, "Szene 1"),
  page("szene-2", "akt-1", 1, "Szene 2"),
  page("akt-2", "buch", 1, "Akt II"),
  page("szene-3", "akt-2", 0, "Szene 3"),
];

describe("buildReadingOrder", () => {
  it("walks parents before children, siblings by sortIndex", () => {
    assert.deepEqual(
      buildReadingOrder(BOOK).map((entry) => entry.id),
      ["buch", "akt-1", "szene-1", "szene-2", "akt-2", "szene-3"],
    );
  });

  it("reports the nesting depth", () => {
    assert.deepEqual(
      buildReadingOrder(BOOK).map((entry) => entry.depth),
      [0, 1, 2, 2, 1, 2],
    );
  });

  it("puts pages without a sortIndex behind the sorted ones, then by title", () => {
    const mixed = [
      page("b", null, null, "Bertha"),
      page("a", null, null, "Anton"),
      page("c", null, 0, "Cäsar"),
    ];

    assert.deepEqual(
      buildReadingOrder(mixed).map((entry) => entry.title),
      ["Cäsar", "Anton", "Bertha"],
    );
  });

  it("limits the order to one subtree when a root is given", () => {
    assert.deepEqual(
      buildReadingOrder(BOOK, "akt-1").map((entry) => entry.id),
      ["akt-1", "szene-1", "szene-2"],
    );
  });

  it("treats a page whose parent is outside the set as a root", () => {
    const orphan = [page("kind", "fehlt", 0), page("wurzel", null, 0)];

    assert.deepEqual(
      buildReadingOrder(orphan).map((entry) => entry.id).sort(),
      ["kind", "wurzel"],
    );
  });

  it("survives a cycle instead of hanging", () => {
    const cyclic = [page("a", "b", 0), page("b", "a", 0)];
    assert.ok(buildReadingOrder(cyclic).length <= 2);
  });
});

describe("findReadingNeighbours", () => {
  const order = buildReadingOrder(BOOK);

  it("finds what comes before and after", () => {
    const at = findReadingNeighbours(order, "szene-2");
    assert.equal(at.previous?.id, "szene-1");
    assert.equal(at.next?.id, "akt-2");
    assert.equal(at.total, 6);
  });

  it("has no predecessor at the start and no successor at the end", () => {
    assert.equal(findReadingNeighbours(order, "buch").previous, null);
    assert.equal(findReadingNeighbours(order, "szene-3").next, null);
  });

  it("returns empty neighbours for a page that is not in the order", () => {
    const at = findReadingNeighbours(order, "gibt-es-nicht");
    assert.equal(at.current, null);
    assert.equal(at.previous, null);
  });
});

describe("buildAncestorTrail", () => {
  it("returns the chain from the root down to the page", () => {
    assert.deepEqual(
      buildAncestorTrail(BOOK, "szene-3").map((entry) => entry.id),
      ["buch", "akt-2", "szene-3"],
    );
  });

  it("returns just the page itself for a root", () => {
    assert.deepEqual(
      buildAncestorTrail(BOOK, "buch").map((entry) => entry.id),
      ["buch"],
    );
  });

  it("stops on a cycle", () => {
    const cyclic = [page("a", "b", 0), page("b", "a", 0)];
    assert.equal(buildAncestorTrail(cyclic, "a").length, 2);
  });
});

describe("findReadingRoot / findChildren", () => {
  it("finds the book a scene belongs to", () => {
    assert.equal(findReadingRoot(BOOK, "szene-3")?.id, "buch");
  });

  it("lists direct children in reading order", () => {
    assert.deepEqual(
      findChildren(BOOK, "akt-1").map((entry) => entry.id),
      ["szene-1", "szene-2"],
    );
    assert.deepEqual(findChildren(BOOK, "szene-1"), []);
  });
});
