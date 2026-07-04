import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fetchImapInboxMessages, describeImapError } from "./imap-sync";

describe("imap-sync", () => {
  it("rejects when IMAP host is unreachable", async () => {
    await assert.rejects(
      () =>
        fetchImapInboxMessages(
          {
            host: "127.0.0.1",
            port: 19993,
            username: "test",
            password: "test",
            secure: false,
          },
          { limit: 1 },
        ),
      /(ECONNREFUSED|connect|timeout|closed)/i,
    );
  });
});

describe("describeImapError", () => {
  it("surfaces the server responseText instead of the generic 'Command failed' message", () => {
    const error = new Error("Command failed") as Error & {
      responseText?: string;
      responseStatus?: string;
    };
    error.responseText = "AUTHENTICATIONFAILED Application-specific password required";
    error.responseStatus = "NO";

    assert.equal(
      describeImapError(error),
      "NO: AUTHENTICATIONFAILED Application-specific password required",
    );
  });

  it("falls back to error.message when no responseText is present", () => {
    assert.equal(describeImapError(new Error("ECONNREFUSED")), "ECONNREFUSED");
  });

  it("stringifies non-Error values", () => {
    assert.equal(describeImapError("boom"), "boom");
  });
});
