import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMailTransport } from "./transport";
import type { SmtpConfig } from "./types";

const mockConfig: SmtpConfig = {
  enabled: true,
  host: "smtp.example.com",
  port: 587,
  secure: false,
  user: "user",
  password: "secret",
  from: "test@example.org",
  logBody: false,
  useMock: true,
};

describe("mail transport", () => {
  it("mock transport sends successfully with recipients", async () => {
    const transport = createMailTransport(mockConfig);
    const result = await transport.send({
      to: [{ email: "player@example.org", name: "Player" }],
      subject: "Test",
      text: "Hello",
    });

    assert.equal(result.ok, true);
    assert.ok(result.messageId?.startsWith("mock-"));
  });

  it("mock transport rejects empty recipient list", async () => {
    const transport = createMailTransport(mockConfig);
    const result = await transport.send({
      to: [],
      subject: "Test",
      text: "Hello",
    });

    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /Empfänger/i);
  });

  it("mock transport verify succeeds", async () => {
    const transport = createMailTransport(mockConfig);
    const result = await transport.verify();
    assert.equal(result.ok, true);
  });
});
