import { expect, type Page } from "@playwright/test";

/**
 * Die Prüfungen des v3-Redesigns, die axe **nicht** abdeckt.
 *
 * axe-core findet fehlende Beschriftungen, kaputte ARIA-Beziehungen und
 * Kontrastfehler auf einfarbigem Grund. Es findet nicht: waagerechtes Scrollen,
 * zu kleine Schrift, zu kleine Trefferflächen und eine Sprungmarke, die zwar da
 * ist, aber ins Leere zeigt. Genau das waren die vier Befunde, die das Redesign
 * ausgelöst haben — deshalb stehen sie hier als eigene Prüfungen neben axe.
 *
 * Die Schwellen entsprechen `packages/shared-ui/src/design-v3`: 12 px
 * Mindestschriftgröße; bei der Trefferfläche siehe die Konstanten unten.
 */

/** `--uwe-text-2xs`. Darunter gibt es im Produkt keinen Text mehr. */
const MIN_FONT_PX = 12;

/**
 * Mindest-Trefferfläche — und warum es zwei Werte sind.
 *
 * WCAG 2.2 kennt zwei Stufen: 2.5.8 „Target Size (Minimum)" verlangt auf
 * **AA** 24 × 24 CSS-Pixel, 2.5.5 „Target Size" auf **AAA** 44 × 44. UWE zielt
 * auf AA, also ist 24 die Grenze, an der etwas *falsch* ist.
 *
 * 44 gilt trotzdem — aber dort, wo es zählt: auf Zeigegeräten ohne Präzision.
 * Mit der Maus ist ein 36-px-Knopf bequem zu treffen, mit dem Daumen nicht.
 * Die Matrix prüft den kleinen Viewport deshalb gegen 44 und die großen gegen
 * 24; die Regel dahinter steht als `@media (pointer: coarse)` in
 * `design-v3/controls.css`.
 *
 * Ein einziger 44er-Wert für alles wäre der bequemere Test und die schlechtere
 * Vorgabe: er hätte jede dichte Werkzeugleiste im Studio aufgebläht.
 */
export const MIN_TOUCH_AA_PX = 24;
export const MIN_TOUCH_COARSE_PX = 44;

export interface ShellAuditFinding {
  /** Kurzer Selektorpfad, damit der Fund ohne Screenshot auffindbar ist. */
  where: string;
  text: string;
  value: string;
}

export interface ShellAuditResult {
  horizontalOverflow: string | null;
  tinyText: ShellAuditFinding[];
  smallTargets: ShellAuditFinding[];
  skipLinkTarget: string | null;
  /** Text jeder `h1` auf der Seite. Genau eine ist richtig. */
  topHeadings: string[];
}

/**
 * Liest den Zustand der Seite im Browser aus. Bewusst eine einzige
 * `evaluate`-Runde: jeder Roundtrip kostet, und die Werte sollen aus demselben
 * Layout-Zustand stammen.
 */
export async function auditShell(page: Page, minTouch: number): Promise<ShellAuditResult> {
  return page.evaluate(
    ({ minFont, minTouch }) => {
      function describe(node: Element): string {
        const parts: string[] = [];
        let current: Element | null = node;
        for (let depth = 0; current && depth < 3; depth += 1) {
          const tag = current.tagName.toLowerCase();
          const cls = current.getAttribute("class");
          // Nur die erste Klasse — der ganze Tailwind-String wäre unlesbar.
          const first = cls?.trim().split(/\s+/)[0];
          parts.unshift(first ? `${tag}.${first}` : tag);
          current = current.parentElement;
        }
        return parts.join(" > ");
      }

      const root = document.scrollingElement ?? document.documentElement;

      // --- Waagerechtes Scrollen -------------------------------------------
      const horizontalOverflow =
        root.scrollWidth > root.clientWidth
          ? `${root.scrollWidth}px Inhalt in ${root.clientWidth}px Fenster`
          : null;

      // --- Zu kleine Schrift ------------------------------------------------
      // Nur Blattknoten mit echtem Text: ein Container erbt seine Größe und
      // würde denselben Fund mehrfach melden.
      const tinyText: { where: string; text: string; value: string }[] = [];
      const scope = document.querySelector("main") ?? document.body;
      for (const node of Array.from(scope.querySelectorAll("*"))) {
        if (node.children.length > 0) continue;
        const text = (node.textContent ?? "").trim();
        if (!text) continue;
        const style = getComputedStyle(node);
        if (style.visibility === "hidden" || style.display === "none") continue;
        const size = parseFloat(style.fontSize);
        if (Number.isFinite(size) && size < minFont) {
          tinyText.push({
            where: describe(node),
            text: text.slice(0, 40),
            value: `${size.toFixed(1)}px`,
          });
        }
      }

      // --- Zu kleine Trefferflächen ----------------------------------------
      //
      // Gemessen wird die *Trefferfläche*, nicht das Element. Zwei Fälle, in
      // denen beides auseinanderfällt und ein Fund falsch wäre:
      //
      //   1. Visuell versteckte Eingaben (`sr-only`): eine Radio-Schaltfläche
      //      im `position: absolute; width: 1px`-Muster ist nie das Ziel — man
      //      tippt das Label, das sie umschließt.
      //   2. Eine kleine Eingabe in einem großen Label: auch hier ist das Label
      //      die Fläche, die den Klick annimmt.
      //
      // In beiden Fällen wird deshalb das Label gemessen.
      function isVisuallyHidden(style: CSSStyleDeclaration, box: DOMRect): boolean {
        if (box.width <= 1 || box.height <= 1) return true;
        const clip = style.clipPath;
        return clip !== "none" && clip.includes("inset(50%)");
      }

      const smallTargets: { where: string; text: string; value: string }[] = [];
      const interactive = document.querySelectorAll(
        'a[href], button, [role="button"], summary, input:not([type="hidden"]), select',
      );
      for (const node of Array.from(interactive)) {
        const style = getComputedStyle(node);
        if (style.visibility === "hidden" || style.display === "none") continue;

        let box = node.getBoundingClientRect();
        // Größe 0 heißt: ausgeklappt-versteckt oder rein dekorativ.
        if (box.width === 0 || box.height === 0) continue;

        const label = node.closest("label");
        if (label && (isVisuallyHidden(style, box) || label.contains(node))) {
          box = label.getBoundingClientRect();
        } else if (isVisuallyHidden(style, box)) {
          continue;
        }

        if (box.height < minTouch || box.width < minTouch) {
          smallTargets.push({
            where: describe(node),
            text: (node.textContent ?? "").trim().slice(0, 30),
            value: `${Math.round(box.width)}x${Math.round(box.height)}`,
          });
        }
      }

      // --- Seitenüberschrift ------------------------------------------------
      // Zwei `h1` sind kein Schönheitsfehler: der Screenreader meldet zwei
      // Seitenüberschriften und die Gliederung hat keine eindeutige Spitze
      // mehr. Im Welt-Cockpit stand der Weltname deshalb zweimal untereinander.
      const topHeadings = Array.from(document.querySelectorAll("h1"))
        .filter((node) => {
          const style = getComputedStyle(node);
          return style.visibility !== "hidden" && style.display !== "none";
        })
        .map((node) => (node.textContent ?? "").trim().slice(0, 60));

      // --- Sprungmarke ------------------------------------------------------
      // Vorhanden ist zu wenig: sie muss auf ein Element zeigen, das es gibt.
      const skip = document.querySelector<HTMLAnchorElement>("a.uwe-skip-link");
      const href = skip?.getAttribute("href") ?? null;
      const skipLinkTarget =
        href && href.startsWith("#") && document.querySelector(href) ? href : null;

      return { horizontalOverflow, tinyText, smallTargets, skipLinkTarget, topHeadings };
    },
    { minFont: MIN_FONT_PX, minTouch },
  );
}

/** Wendet die Schwellen als Erwartungen an und benennt jeden Fund einzeln. */
export function expectShellAuditClean(
  result: ShellAuditResult,
  label: string,
  minTouch: number,
): void {
  expect(result.horizontalOverflow, `${label}: waagerechtes Scrollen`).toBeNull();

  expect(
    result.tinyText,
    `${label}: Text unter ${MIN_FONT_PX}px:\n${JSON.stringify(result.tinyText, null, 2)}`,
  ).toEqual([]);

  expect(
    result.smallTargets,
    `${label}: Trefferfläche unter ${minTouch}px:\n${JSON.stringify(result.smallTargets, null, 2)}`,
  ).toEqual([]);

  expect(result.skipLinkTarget, `${label}: Sprungmarke zeigt ins Leere`).not.toBeNull();

  expect(
    result.topHeadings.length,
    `${label}: genau eine Seitenüberschrift erwartet, gefunden: ${JSON.stringify(result.topHeadings)}`,
  ).toBe(1);
}

/**
 * Die Viewports der Prüfmatrix — Telefon, Tablet, Schreibtisch.
 *
 * Die Breite allein sagt nichts über das Zeigegerät: ein 390-px-Fenster am
 * Schreibtisch wird mit der Maus bedient. Die 44-px-Prüfung hängt deshalb nicht
 * hier, sondern an einem eigenen Testblock mit `hasTouch`.
 */
export const AUDIT_VIEWPORTS = [
  { name: "390px", width: 390, height: 844 },
  { name: "768px", width: 768, height: 1024 },
  { name: "1440px", width: 1440, height: 900 },
] as const;

/**
 * Setzt das Theme so, wie es der Nutzer tut: über das Attribut auf `<html>`,
 * das die Theme-Engine schreibt. Ein Neuladen würde es zurücksetzen, deshalb
 * wird es nach der Navigation gesetzt.
 */
export async function applyTheme(page: Page, mode: "hell" | "dunkel"): Promise<void> {
  await page.evaluate((theme) => {
    document.documentElement.setAttribute("data-uwe-theme", theme);
  }, mode === "hell" ? "uwe-ghibli-tag" : "uwe-ghibli-nacht");
  // Ein Frame Zeit, damit die Custom Properties durchschlagen, bevor gemessen wird.
  await page.waitForTimeout(120);
}
