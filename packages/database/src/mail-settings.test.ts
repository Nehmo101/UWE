import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAIL_INBOX_LIMIT_DEFAULT,
  MAIL_INBOX_LIMIT_MAX,
  MAIL_INBOX_LIMIT_MIN,
  normalizeMailInboxLimit,
  normalizeMailSyncInterval,
} from "./mail-settings";

describe("mail-settings", () => {
  it("clamps inbox limit to configured bounds", () => {
    assert.equal(normalizeMailInboxLimit(5), MAIL_INBOX_LIMIT_MIN);
    assert.equal(normalizeMailInboxLimit(99999), MAIL_INBOX_LIMIT_MAX);
    assert.equal(normalizeMailInboxLimit("120"), 120);
    assert.equal(normalizeMailInboxLimit("nope"), MAIL_INBOX_LIMIT_DEFAULT);
  });

  it("normalizes auto-sync interval to allowed values", () => {
    assert.equal(normalizeMailSyncInterval(5), 5);
    assert.equal(normalizeMailSyncInterval(15), 15);
    assert.equal(normalizeMailSyncInterval(30), 30);
    assert.equal(normalizeMailSyncInterval(60), 60);
    assert.equal(normalizeMailSyncInterval(7), 15);
  });
});
