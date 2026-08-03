import { expect, test } from "@playwright/test";
import { loginStudio } from "./helpers/auth";

/**
 * Der Rich-Text-Editor der Wiki-Seite — gegen den echten Build.
 *
 * Vorgeschichte: für diese Fläche gab es keinen Browser-Test. Beim Sprung von
 * tiptap 2 auf 3 hat das zweimal wehgetan — erst brach der Typecheck
 * (`ReturnType<typeof useEditor>` enthält das `null` nicht mehr), dann der
 * Build (`@tiptap/react@3` gegen ein zurückgebliebenes `@tiptap/core@2`), und
 * für die Frage danach — **mountet das Ding überhaupt noch und kann man darin
 * schreiben?** — gab es kein Netz. Bei einer Editor-Bibliothek sagt ein
 * erfolgreicher Build darüber wenig.
 *
 * Genau diese Frage prüft der Test, und bewusst nicht mehr: dass die
 * ProseMirror-Fläche clientseitig entsteht, editierbar ist und Eingaben
 * annimmt. Das ist der Teil, den ein Versionssprung zuerst umbringt.
 */

const EDIT_URL = "/worlds/terra/orte/validori/edit";

test("der Rich-Text-Editor mountet und nimmt Text an", async ({ page }) => {
  await loginStudio(page);
  await page.goto(EDIT_URL);

  // Die ProseMirror-Fläche entsteht erst clientseitig — vor der Hydration
  // steht hier nichts. Genau das war beim tiptap-Sprung die offene Frage.
  const surface = page.locator(".uwe-rich-text-editor__surface").first();
  await expect(surface).toBeVisible({ timeout: 15000 });
  await expect(surface).toHaveAttribute("contenteditable", "true");

  await surface.click();
  await page.keyboard.type("Probe aus dem Test");
  await expect(surface).toContainText("Probe aus dem Test");
});
