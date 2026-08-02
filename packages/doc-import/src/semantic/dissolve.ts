/**
 * Durchgang 2: auflösen.
 *
 * Zwei Sorten von Abschnitten sind keine Gegenstände, sondern Verpackung:
 *
 * - **Listen** („Die Räume", „TEIL F — WERTEBLÖCKE", „TEIL G — HANDOUTS")
 *   tragen ihre Gegenstände im Fließtext. Sie zerfallen in ihre Einträge.
 * - **Klammern** („Die drei Zugänge") sagen nichts außer „hier geht es weiter".
 *   Sie verschwinden und geben ihre Kinder nach oben.
 *
 * Was hier **nicht** verschwindet, steht in {@link NEVER_DISSOLVE}: Eine Ebene
 * mit dem Text „Ein Foyer." ist trotzdem eine Ebene, und ein Kapitel bleibt ein
 * Kapitel — sonst würde „Kapitel 1" eine Seite und „Kapitel 2" nicht, je
 * nachdem wie seine Unterabschnitte zufällig eingeordnet wurden.
 */

import type { DocumentNode, SectionRole } from "../types";
import {
  extractDefinitionBullets,
  extractLabelledBlocks,
  looksLikeCombatStatblock,
  splitStatblockBody,
  wrapDmSection,
  type ExtractedBlock,
} from "./blocks";
import type { Counters } from "./counters";
import { shiftHeadings } from "./fold";
import { isListRole, isPageRole } from "./roles";

/** Ab dieser Rumpflänge trägt ein Abschnitt genug eigenen Text, um zu bleiben. */
const CONTAINER_BODY_LENGTH = 240;

/**
 * Taugt dieses Etikett als Suchname?
 *
 * `F.2`, `H.1`, `1.4` verweisen im Dokument auf genau einen Abschnitt und sind
 * als Alias Gold wert. Eine nackte `1` aus einer durchnummerierten Aufzählung
 * ist es nicht — sie würde nur den Welt-Index verstopfen und im Zweifel einen
 * fremden `[[1]]` an sich ziehen.
 */
function usableLabel(label: string | null): label is string {
  return Boolean(label) && /[.\-A-Za-zÄÖÜäöü]/.test(label as string);
}

function blockToNode(
  block: ExtractedBlock,
  level: number,
  sortIndex: number,
  role: SectionRole,
): DocumentNode {
  const node: DocumentNode = {
    level,
    title: block.title,
    body: block.body,
    marker: null,
    sortIndex,
    children: [],
    role,
    aliases: usableLabel(block.label) ? [block.label] : [],
    synthetic: true,
  };

  return role === "statblock" ? splitOffValues(node, block.body) : node;
}

/**
 * Trennt die Regelwerte auf eine eigene Unterseite ab.
 *
 * Die Hauptseite ist das, was man über die Kreatur weiß; die Unterseite trägt
 * die Zahlen und liegt in einem **DM-Bereich** (`:::dm`), den der Server jedem
 * Leser ohne Studio-Häkchen aus dem Text schneidet. Am Spieltisch kann man die
 * Hauptseite also zeigen, ohne die Werte preiszugeben.
 *
 * Getrennt wird nur, wo es etwas zu trennen gibt: Ein Block ganz ohne
 * Wertezeilen („Kein Kampf. Er kämpft nie.") bleibt eine Seite, und ein Block
 * ganz ohne Beschreibung behält seine Werte bei sich. Eine leere Hauptseite
 * wäre schlimmer als die Doppelung, die hier vermieden werden soll.
 */
function splitOffValues(node: DocumentNode, fullBody: string): DocumentNode {
  const { description, values } = splitStatblockBody(fullBody);
  if (!values || !description) return node;

  // Der Typ folgt dem **ganzen** Block: Nach der Trennung stünde auf der
  // Hauptseite keine einzige Regelzeile mehr, und jede Kreatur würde zum NSC.
  const type = looksLikeCombatStatblock(fullBody) ? "monster" : "npc";

  node.body = description;
  node.typeHint = type;
  node.children = [
    {
      level: Math.min(6, node.level + 1),
      title: `Werteblock: ${node.title}`,
      body: wrapDmSection("Werteblock", values),
      marker: null,
      sortIndex: 0,
      children: [],
      role: "statblock_values",
      typeHint: type,
      aliases: [],
      synthetic: true,
    },
  ];

  return node;
}

/**
 * Löst einen Listenabschnitt in seine Einträge auf.
 *
 * Der Abschnitt selbst bleibt zunächst stehen (er trägt die Einleitung), bekommt
 * aber die Einträge als Kinder. Findet sich nichts zum Herauslösen, passiert
 * nichts — dann war es eben Fließtext.
 */
export function dissolveLists(node: DocumentNode, counters: Counters): void {
  dissolveList(node, counters);
  node.children.forEach((child) => dissolveLists(child, counters));
}

function dissolveList(node: DocumentNode, counters: Counters): void {
  const role = node.role;
  if (!role || !isListRole(role)) return;
  if (node.children.length > 0) return; // Untergliederung schlägt Aufzählung.

  const entryRole: SectionRole =
    role === "room_list"
      ? "room"
      : role === "handout_list"
        ? "handout"
        : role === "npc_list"
          ? "npc"
          : "statblock";

  const extracted =
    role === "room_list" ? extractDefinitionBullets(node.body) : extractLabelledBlocks(node.body);

  if (extracted.blocks.length < 2) return;

  node.body = extracted.lead;
  node.children = extracted.blocks.map((block, index) =>
    blockToNode(block, Math.min(6, node.level + 1), index, entryRole),
  );
  counters.extracted += extracted.blocks.length;
}

/**
 * Was im Baum seinen Platz behält, egal wie dünn der eigene Text ist.
 *
 * `part` steht bewusst dabei. Die Klammer, die den Dungeon-Import verdarb
 * („TEIL C — DER TURM"), löst sich ohnehin von selbst auf: `liftLevels` holt die
 * Ebenen heraus, danach ist sie leer und {@link dropEmptyShells} räumt sie weg.
 *
 * `statblock` ebenfalls: Seine Unterseite ist keine Gliederung, die er umschließt,
 * sondern das Ergebnis von {@link splitOffValues}. Ohne diesen Eintrag würde die
 * Kreatur auflösen und nur ihr eigener Werteblock bliebe übrig — eine Seite
 * „Werteblock: Nepurga" ohne Nepurga.
 */
const NEVER_DISSOLVE = new Set<SectionRole>([
  "volume",
  "dungeon",
  "level",
  "room",
  "part",
  "statblock",
]);

function shouldDissolve(node: DocumentNode): boolean {
  if (!node.role || !isPageRole(node.role)) return false;
  if (NEVER_DISSOLVE.has(node.role)) return false;

  // Räume gehören an die Ebene, nicht an eine Zwischenseite „Die Räume".
  // Werteblöcke und Handouts dagegen behalten ihre Sammelseite: Sie sind ein
  // Anhang, kein Bestandteil des Ortes, an dem sie vorkommen.
  if (node.role === "room_list") return node.children.length >= 1;
  if (isListRole(node.role)) return false;

  if (node.body.trim().length > CONTAINER_BODY_LENGTH) return false;

  const pageChildren = node.children.filter((child) => child.role && isPageRole(child.role));
  return pageChildren.length >= 1 && pageChildren.length === node.children.length;
}

export function dissolveContainers(parent: DocumentNode, counters: Counters): void {
  const out: DocumentNode[] = [];

  for (const child of parent.children) {
    dissolveContainers(child, counters);

    if (shouldDissolve(child)) {
      counters.dissolved += 1;

      // Die Einleitung der Klammer geht nicht verloren, sie rückt eine Ebene
      // hoch: „Vier Nischen, alle mit Statuen" gehört zur Ebene, auch wenn die
      // Zwischenüberschrift „Die Räume" verschwindet.
      if (child.body.trim()) {
        parent.body = [parent.body.trim(), `## ${child.title}`, shiftHeadings(child.body.trim(), 1)]
          .filter(Boolean)
          .join("\n\n");
      }

      for (const grandchild of child.children) {
        grandchild.level = child.level;
        out.push(grandchild);
      }
      continue;
    }

    out.push(child);
  }

  parent.children = out;
  out.forEach((node, index) => {
    node.sortIndex = index;
  });
}

/**
 * Leere Hüllen wegräumen.
 *
 * Nach dem Hochziehen der Ebenen kann eine Gliederungsklammer übrig bleiben, die
 * nichts mehr enthält — „Der Turm", nachdem alle sechs Stockwerke unter den
 * Dungeon gewandert sind. Eine Seite ohne Text und ohne Unterseiten ist im Wiki
 * eine Sackgasse; Gegenstände bleiben trotzdem stehen, denn ein Raum ohne
 * Beschreibung ist immer noch ein Raum, den man betreten kann.
 */
export function dropEmptyShells(node: DocumentNode, counters: Counters): void {
  const kept = node.children.filter((child) => {
    dropEmptyShells(child, counters);

    const empty = !child.body.trim() && child.children.length === 0;
    const disposable = child.role === "part" || child.role === "section" || child.role === "detail";
    if (empty && disposable) {
      counters.dissolved += 1;
      return false;
    }
    return true;
  });

  node.children = kept;
  kept.forEach((child, index) => {
    child.sortIndex = index;
  });
}
