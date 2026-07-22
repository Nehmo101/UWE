import assert from "node:assert/strict";
import { describe, it } from "node:test";
// @ts-expect-error — zero-dep .mjs guard, no type declarations by design.
import { checkImport } from "./product-boundary-check.mjs";

describe("product boundary guard: checkImport", () => {
  it("flags an app importing another app via @uwe/<app>", () => {
    assert.equal(checkImport("apps/studio/app/page.tsx", "@uwe/portal").rule, "cross-app-import");
    assert.equal(checkImport("apps/brain/app/page.tsx", "@uwe/studio").rule, "cross-app-import");
    assert.equal(checkImport("apps/portal/src/x.ts", "@uwe/brain/lib").rule, "cross-app-import");
  });

  it("flags an app importing another app via a relative escape", () => {
    assert.equal(
      checkImport("apps/studio/app/page.tsx", "../../portal/app/thing").rule,
      "cross-app-import",
    );
  });

  it("flags a package or tool importing an app", () => {
    assert.equal(checkImport("packages/shared-ui/src/x.ts", "@uwe/studio").rule, "package-to-app-import");
    assert.equal(checkImport("tools/uwe-host-command-center/src/x.ts", "@uwe/brain").rule, "package-to-app-import");
  });

  it("allows self-imports, shared engines and relative in-app imports", () => {
    assert.equal(checkImport("apps/studio/app/page.tsx", "@uwe/studio/thing"), null);
    assert.equal(checkImport("apps/studio/app/page.tsx", "@uwe/shared-ui"), null);
    assert.equal(checkImport("apps/brain/app/page.tsx", "@uwe/product-contracts"), null);
    assert.equal(checkImport("packages/shared-ui/src/x.ts", "@uwe/auth"), null);
    assert.equal(checkImport("apps/studio/app/page.tsx", "./local"), null);
    assert.equal(checkImport("apps/studio/app/page.tsx", "next/navigation"), null);
  });
});
