import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fetchImapInboxMessages } from "./imap-sync";

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
