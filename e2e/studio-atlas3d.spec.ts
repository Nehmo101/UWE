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

  test("region drill-down creates a continent in top-down mode", async ({ page }) => {
    await page.goto("/worlds/terra/atlas3d");
    await expect(page.getByTestId("atlas3d-editor")).toBeVisible();

    const webgl = await page.evaluate(() => {
      const probe = document.createElement("canvas");
      return Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
    });
    test.skip(!webgl, "Chromium has no WebGL/SwiftShader context");

    await page.getByTestId("atlas3d-tool-region").click();
    const canvas = page.getByTestId("atlas3d-canvas");
    const box = await canvas.boundingBox();
    test.skip(!box, "canvas has no layout box");
    if (!box) return;
    // three clicks on the front-facing hemisphere of the globe
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await canvas.click({ position: { x: box.width / 2 - 40, y: box.height / 2 - 20 } });
    await canvas.click({ position: { x: box.width / 2 + 45, y: box.height / 2 - 25 } });
    await canvas.click({ position: { x: box.width / 2, y: box.height / 2 + 45 } });
    void cx;
    void cy;
    await expect(page.getByTestId("atlas3d-region-panel")).toContainText("3 Punkte");

    await page.getByTestId("atlas3d-region-title").fill("Velthara");
    await page.getByTestId("atlas3d-region-create").click();

    // navigates onto the freshly created continent — terrain mode, water slider, inherit badge
    await expect(page).toHaveURL(/\/worlds\/terra\/atlas3d\/[a-z0-9]+/i);
    await expect(page.getByTestId("atlas3d-editor")).toHaveAttribute("data-mode", "terrain");
    await expect(page.getByTestId("atlas3d-water-level")).toBeVisible();
    await expect(page.getByTestId("atlas3d-water-badge")).toContainText("geerbt");

    // breadcrumb leads back up to the globe
    await page.getByRole("link", { name: "Atlas 3D" }).first().click();
    await expect(page.getByTestId("atlas3d-editor")).toHaveAttribute("data-mode", "globe");
  });

  test("asset placement commits an undoable object step with tint choice", async ({ page }) => {
    await page.goto("/worlds/terra/atlas3d");
    await expect(page.getByTestId("atlas3d-editor")).toBeVisible();

    const webgl = await page.evaluate(() => {
      const probe = document.createElement("canvas");
      return Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
    });
    test.skip(!webgl, "Chromium has no WebGL/SwiftShader context");

    await page.getByTestId("atlas3d-tool-asset").click();
    await expect(page.getByTestId("atlas3d-asset-panel")).toBeVisible();
    await page.getByTestId("atlas3d-asset-worldroot").click();
    await page.getByRole("button", { name: "Farbe Tintenblau" }).click();

    const canvas = page.getByTestId("atlas3d-canvas");
    const box = await canvas.boundingBox();
    test.skip(!box, "canvas has no layout box");
    if (!box) return;
    await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });

    const undo = page.getByTestId("atlas3d-undo");
    await expect(undo).toBeEnabled();
    await expect(page.getByTestId("atlas3d-save-state")).not.toContainText("Fehler");
    await undo.click();
    await expect(undo).toBeDisabled();
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
