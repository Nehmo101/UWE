import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderMailTemplate } from "./mail-utils";

describe("mail-utils", () => {
  it("renders template placeholders", () => {
    const rendered = renderMailTemplate("Hallo {{name}}, Session {{sessionNumber}}", {
      name: "Gruppe",
      sessionNumber: 3,
      missing: null,
    });
    assert.equal(rendered, "Hallo Gruppe, Session 3");
  });
});
