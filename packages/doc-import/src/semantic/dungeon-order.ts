/**
 * Durchgang 4: die Dungeon-Invariante.
 *
 * Das Dungeon-Cockpit liest Ebenen als **direkte** Kinder der Dungeon-Seite und
 * Räume als direkte Kinder einer Ebene (`dungeon-cockpit.ts`). Steht eine Ebene
 * eine Gliederungsklammer tiefer, ist sie für das Cockpit unsichtbar — genau
 * das ließ von acht Ebenen eines Turms exakt eine ankommen: „TEIL D — DAS DACH",
 * die einzige, die zufällig direkt unter der Wurzel stand.
 *
 * Deshalb ist das hier eine **Invariante**, kein Aufräumschritt: Der Baum wird
 * ausdrücklich in die Form gebracht, die das Cockpit lesen kann, statt sich
 * darauf zu verlassen, dass die vorherigen Durchgänge es zufällig richtig
 * machen.
 */

import type { DocumentNode } from "../types";

/**
 * Zieht jede Ebene direkt unter den Dungeon.
 *
 * Die Lesereihenfolge bleibt die des Dokuments: Ebenen wandern an die Stelle,
 * an der sie im Text standen, nicht ans Ende.
 */
export function liftLevels(root: DocumentNode): void {
  // Dokumentreihenfolge festhalten, bevor umgehängt wird — `sortIndex` gilt nur
  // unter Geschwistern und taugt nach dem Umhängen nicht mehr zum Vergleich.
  const order = new Map<DocumentNode, number>();
  let counter = 0;
  const stamp = (nodes: DocumentNode[]) => {
    for (const node of nodes) {
      order.set(node, (counter += 1));
      stamp(node.children);
    }
  };
  stamp(root.children);

  const lifted: DocumentNode[] = [];

  const collect = (nodes: DocumentNode[], depth: number): DocumentNode[] =>
    nodes.filter((node) => {
      node.children = collect(node.children, depth + 1);
      if (depth > 0 && node.role === "level") {
        lifted.push(node);
        return false;
      }
      return true;
    });

  const remaining = collect(root.children, 0);
  if (lifted.length === 0) return;

  root.children = [...remaining, ...lifted].sort(
    (a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0),
  );
  root.children.forEach((child, index) => {
    child.sortIndex = index;
    child.level = 2;
  });
}

/**
 * Räume hängen unter Ebenen.
 *
 * Ein Raum, der außerhalb jeder Ebene steht, ist im Cockpit nicht erreichbar.
 * Statt ihn dort zu verstecken, wird er zum Ort — er ist ja einer.
 */
export function demoteOrphanRooms(node: DocumentNode, insideLevel: boolean): void {
  for (const child of node.children) {
    if (child.role === "room" && !insideLevel) {
      child.role = "location";
      child.typeHint = "location";
    }
    demoteOrphanRooms(child, insideLevel || child.role === "level");
  }
}
