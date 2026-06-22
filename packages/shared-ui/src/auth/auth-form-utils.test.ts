import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFormFieldValue } from "./auth-form-utils";

function makeMockForm(fields: Record<string, string>): HTMLFormElement {
  const controls = Object.fromEntries(
    Object.entries(fields).map(([name, value]) => [name, { value }]),
  );

  return {
    elements: {
      namedItem(name: string) {
        return controls[name] ?? null;
      },
    },
  } as unknown as HTMLFormElement;
}

describe("auth form utils", () => {
  it("reads named control values for mobile autofill fallbacks", () => {
    const form = makeMockForm({
      email: "dm@uwe.local",
      password: "uwe-dev",
    });

    assert.equal(readFormFieldValue(form, "email", ""), "dm@uwe.local");
    assert.equal(readFormFieldValue(form, "password", ""), "uwe-dev");
  });

  it("uses provided fallback when field is missing", () => {
    const form = makeMockForm({});
    assert.equal(readFormFieldValue(form, "email", "fallback@uwe.local"), "fallback@uwe.local");
  });
});
