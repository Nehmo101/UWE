import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findReleaseForVersion,
  getChangelogReleases,
  parseChangelog,
} from "./changelog";

const SAMPLE = `# Changelog

## [Unreleased]

### Added

- **Feature A** — first item
- Second item

### Changed

- **Labels** — sharper copy

## [0.1.0] - 2026-06-11

First usable release.

### Added

- **UWE Studio** — DM editor
- **UWE Portal** — player wiki

### Security

- DM-only content filtered server-side

[0.1.0]: https://github.com/uwe/uwe/releases/tag/v0.1.0
`;

describe("parseChangelog", () => {
  it("parses releases, sections, bullets, and footer links", () => {
    const releases = parseChangelog(SAMPLE);
    assert.equal(releases.length, 2);

    const unreleased = releases[0]!;
    assert.equal(unreleased.version, "Unreleased");
    assert.equal(unreleased.unreleased, true);
    assert.equal(unreleased.date, null);
    assert.equal(unreleased.sections.length, 2);
    assert.equal(unreleased.sections[0]!.kind, "Added");
    assert.match(unreleased.sections[0]!.items[0]!, /Feature A/);

    const v010 = releases[1]!;
    assert.equal(v010.version, "0.1.0");
    assert.equal(v010.date, "2026-06-11");
    assert.equal(v010.url, "https://github.com/uwe/uwe/releases/tag/v0.1.0");
    assert.equal(v010.sections.length, 2);
    assert.equal(v010.sections[1]!.kind, "Security");
  });

  it("findReleaseForVersion matches semver without v prefix", () => {
    const releases = parseChangelog(SAMPLE);
    const match = findReleaseForVersion(releases, "0.1.0");
    assert.ok(match);
    assert.equal(match!.version, "0.1.0");
    assert.equal(findReleaseForVersion(releases, "9.9.9"), null);
  });

  it("parses CRLF line endings the same as LF", () => {
    // On Windows checkouts (core.autocrlf) the CHANGELOG arrives with CRLF;
    // the parser must not depend on the checkout OS.
    const releases = parseChangelog(SAMPLE.replace(/\n/g, "\r\n"));
    assert.deepEqual(releases, parseChangelog(SAMPLE));
    assert.equal(releases.length, 2);
    assert.equal(releases[1]!.date, "2026-06-11");
    assert.equal(releases[1]!.url, "https://github.com/uwe/uwe/releases/tag/v0.1.0");
  });

  it("loads the project CHANGELOG when present", () => {
    const releases = getChangelogReleases();
    assert.ok(releases.length >= 1);
    assert.ok(releases.some((release) => release.version === "0.1.0"));
  });
});
