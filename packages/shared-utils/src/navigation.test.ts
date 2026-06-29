import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findNavConflicts,
  flattenNavGroups,
  isNavItemActive,
  navGroupsToCommands,
  normalizeNavPath,
  resolveNavGroups,
  type NavGroup,
} from "./navigation";

const sample: NavGroup[] = [
  {
    id: "g1",
    title: "Group 1",
    items: [
      {
        id: "a",
        label: "Alpha",
        href: "/alpha",
        icon: "a",
        group: "Group 1",
        section: "S",
        permission: ["owner"],
        status: "active",
        source: "studio",
        keywords: ["alpha"],
      },
      {
        id: "b",
        label: "Beta",
        href: "/beta?tab=x",
        icon: "b",
        group: "Group 1",
        section: "S",
        permission: ["owner"],
        status: "hidden",
        source: "studio",
      },
    ],
  },
];

describe("navigation contract helpers", () => {
  it("normalizes paths", () => {
    assert.equal(normalizeNavPath("/a/b/"), "/a/b");
    assert.equal(normalizeNavPath("//a//b"), "/a/b");
    assert.equal(normalizeNavPath("/a?x=1#frag"), "/a?x=1");
    assert.equal(normalizeNavPath(""), "/");
  });

  it("matches active items by exact, tab, and prefix", () => {
    assert.equal(isNavItemActive("/alpha", "/alpha"), true);
    assert.equal(isNavItemActive("/alpha/child", "/alpha"), true);
    assert.equal(isNavItemActive("/beta?tab=x", "/beta?tab=x"), true);
    assert.equal(isNavItemActive("/beta?tab=y", "/beta?tab=x"), false);
    assert.equal(isNavItemActive("/other", "/alpha"), false);
    assert.equal(isNavItemActive("/alphabet", "/alpha"), false);
  });

  it("flattens and resolves active flags", () => {
    assert.equal(flattenNavGroups(sample).length, 2);
    const resolved = resolveNavGroups(sample, "/alpha");
    assert.equal(resolved[0]!.items[0]!.active, true);
    assert.equal(resolved[0]!.items[1]!.active, false);
  });

  it("builds commands and skips hidden items", () => {
    const commands = navGroupsToCommands(sample);
    assert.equal(commands.length, 1);
    assert.equal(commands[0]!.id, "a");
    assert.equal(commands[0]!.group, "S / Group 1");
  });

  it("detects duplicate ids/hrefs/labels", () => {
    const dupes: NavGroup[] = [
      {
        id: "g",
        title: "G",
        items: [
          {
            id: "x",
            label: "L",
            href: "/p",
            icon: "i",
            group: "G",
            section: "S",
            permission: ["owner"],
            status: "active",
            source: "studio",
          },
          {
            id: "x",
            label: "L",
            href: "/p",
            icon: "i",
            group: "G",
            section: "S",
            permission: ["owner"],
            status: "active",
            source: "studio",
          },
        ],
      },
    ];
    const conflicts = findNavConflicts(flattenNavGroups(dupes));
    assert.deepEqual(conflicts.duplicateIds, ["x"]);
    assert.deepEqual(conflicts.duplicateHrefs, ["/p"]);
    assert.deepEqual(conflicts.duplicateLabels, ["S:L"]);
  });
});
