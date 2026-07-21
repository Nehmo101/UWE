import { expect, test } from "@playwright/test";

import { loginPortalPlayer } from "./helpers/auth";

test.describe("Portal Atlas 3D (read-only Viewer)", () => {
  test.beforeEach(async ({ page }) => {
    await loginPortalPlayer(page);
  });

  test("players can browse the 3D atlas hierarchy read-only", async ({ page }) => {
    await page.goto("/auth/worlds/terra/atlas3d");
    await expect(page.getByRole("heading", { name: "Atlas 3D" })).toBeVisible();

    const tree = page.getByTestId("atlas3d-portal-tree");
    const empty = page.getByTestId("atlas3d-portal-empty");
    // the e2e DB starts blank until a DM opens the Studio editor — both states are valid
    await expect(tree.or(empty)).toBeVisible();
    test.skip(await empty.isVisible(), "No Atlas 3D world seeded in this run");

    await tree.locator("a").first().click();
    await expect(page.getByTestId("atlas3d-portal-viewer")).toBeVisible();
    await expect(page.getByTestId("atlas3d-portal-canvas")).toBeVisible();
    // strictly read-only: no editor toolbar, no save state
    await expect(page.getByTestId("atlas3d-editor")).toHaveCount(0);
    await expect(page.getByTestId("atlas3d-save-state")).toHaveCount(0);
  });
});
