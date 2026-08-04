import test from "node:test";
import assert from "node:assert/strict";
import { detectCommunities } from "./graph-communities";

function adjFrom(pairs: [string, string][]): Record<string, Set<string>> {
  const adj: Record<string, Set<string>> = {};
  pairs.forEach(([a, b]) => {
    (adj[a] || (adj[a] = new Set())).add(b);
    (adj[b] || (adj[b] = new Set())).add(a);
  });
  return adj;
}

test("zwei Dreiecke mit einer Brücke bilden zwei Communities", () => {
  const ids = ["a1", "a2", "a3", "b1", "b2", "b3"];
  const adj = adjFrom([
    ["a1", "a2"],
    ["a2", "a3"],
    ["a1", "a3"],
    ["b1", "b2"],
    ["b2", "b3"],
    ["b1", "b3"],
    ["a1", "b1"], // Brücke
  ]);
  const com = detectCommunities(ids, adj);
  assert.equal(com.get("a1"), com.get("a2"));
  assert.equal(com.get("a2"), com.get("a3"));
  assert.equal(com.get("b1"), com.get("b2"));
  assert.equal(com.get("b2"), com.get("b3"));
  assert.notEqual(com.get("a1"), com.get("b1"), "Brücke darf die Grüppchen nicht verschmelzen");
});

test("voll verbundener Graph ist eine einzige Community", () => {
  const ids = ["x", "y", "z"];
  const adj = adjFrom([
    ["x", "y"],
    ["y", "z"],
    ["x", "z"],
  ]);
  const com = detectCommunities(ids, adj);
  assert.equal(com.get("x"), com.get("y"));
  assert.equal(com.get("y"), com.get("z"));
});

test("isolierte Knoten behalten eigene Communities, Indizes sind kompakt", () => {
  const ids = ["solo1", "solo2", "p1", "p2"];
  const adj = adjFrom([["p1", "p2"]]);
  const com = detectCommunities(ids, adj);
  assert.equal(com.get("p1"), com.get("p2"));
  assert.notEqual(com.get("solo1"), com.get("solo2"));
  assert.notEqual(com.get("solo1"), com.get("p1"));
  const values = [...new Set(com.values())].sort((a, b) => a - b);
  assert.deepEqual(values, [0, 1, 2], "Community-Indizes müssen kompakt bei 0 beginnen");
});

test("Ergebnis ist deterministisch", () => {
  const ids = ["a1", "a2", "a3", "b1", "b2", "b3"];
  const adj = adjFrom([
    ["a1", "a2"],
    ["a2", "a3"],
    ["a1", "a3"],
    ["b1", "b2"],
    ["b2", "b3"],
    ["b1", "b3"],
    ["a1", "b1"],
  ]);
  const first = detectCommunities(ids, adj);
  const second = detectCommunities(ids, adj);
  assert.deepEqual([...first.entries()], [...second.entries()]);
});
