import { expect, test } from "@playwright/test";

import { loginStudio } from "./helpers/auth";

test.describe("Studio Atlas 3D (neuer Editor)", () => {
  test.beforeEach(async ({ page }) => {
    await loginStudio(page);
  });

  test("bootstraps the globe and mounts the editor shell", async ({ page }) => {
    await page.goto("/worlds/terra/atlas3d");
    // Index redirects onto the lazily created root globe node.
    await expect(page).toHaveURL(/\/worlds\/terra\/atlas3d\/[a-z0-9]+/i);

    const editor = page.getByTestId("atlas3d-editor");
    await expect(editor).toBeVisible();
    await expect(page.getByTestId("atlas3d-canvas")).toBeVisible();
    await expect(page.getByTestId("atlas3d-save-state")).toContainText("gespeichert");

    // Tools are real buttons with pressed state.
    const bite = page.getByTestId("atlas3d-tool-bite");
    await bite.click();
    await expect(bite).toHaveAttribute("aria-pressed", "true");

    // Undo starts empty and disabled.
    await expect(page.getByTestId("atlas3d-undo")).toBeDisabled();
  });

  test("split slider commits an undoable Welt-teilen step", async ({ page }) => {
    await page.goto("/worlds/terra/atlas3d");
    await expect(page.getByTestId("atlas3d-editor")).toBeVisible();

    const webgl = await page.evaluate(() => {
      const probe = document.createElement("canvas");
      return Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
    });
    test.skip(!webgl, "Chromium has no WebGL/SwiftShader context");

    const slider = page.getByTestId("atlas3d-split-gap");
    await slider.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");

    const undo = page.getByTestId("atlas3d-undo");
    await expect(undo).toBeEnabled();
    await undo.click();
  });
});
