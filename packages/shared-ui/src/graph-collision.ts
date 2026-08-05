// UWE Graph — "Nicht berühren": positions-basierte Kollisionsauflösung.
//
// Aus `graph-engine.ts` herausgezogen (Modul-Disziplin: Monolith nicht anbauen).
// Framework-agnostisch, arbeitet auf jedem Array mit {x, y, r, fixed}.

export interface CollidableNode {
  x: number;
  y: number;
  r: number;
  /** Fixierte Knoten (Auswahl/aktiver Drag) bleiben stehen und drängen Nachbarn weg. */
  fixed: boolean;
  /** Optionale Grüppchen-Zuordnung: Paare aus verschiedenen Gruppen halten `interPad`. */
  group?: number;
}

/**
 * Löst Überlappungen auf (analog d3 `forceCollide`): Knotenpaare, die näher als die
 * Summe ihrer Radien (+ `pad`) liegen, werden entlang ihrer Verbindungsachse
 * auseinandergeschoben. Fixierte Knoten bewegen sich nicht; zwei bewegliche teilen
 * sich die Verschiebung je zur Hälfte. Tragen beide Knoten eine `group`-Zuordnung
 * und unterscheiden sie sich, gilt `interPad` statt `pad` — so entsteht ein
 * sichtbarer "Moat" zwischen Grüppchen.
 *
 * Adaptiv: Es werden bis zu `maxIters` Durchläufe (Gauss-Seidel-Relaxation)
 * ausgeführt, aber sobald ein Durchlauf kaum noch etwas verschiebt, ist die Packung
 * überlappungsfrei und die Schleife bricht ab. So bleiben ruhende Frames billig,
 * während dichte/frisch initialisierte Cluster genug Iterationen bekommen.
 *
 * Rückgabe: normierte „Energie" des ersten Durchlaufs (Σ overlap² / n) — dient der
 * Ruhe-Erkennung der Simulation (Graph bleibt wach, solange Überlappung existiert).
 */
export function resolveNodeCollisions(
  nodes: CollidableNode[],
  pad: number,
  maxIters: number,
  interPad: number = pad,
): number {
  const eps = 0.05; // Restüberlappung, ab der ein weiterer Durchlauf entfällt
  let firstEnergy = 0;
  for (let it = 0; it < maxIters; it++) {
    let moved = 0;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        let dx = b.x - a.x,
          dy = b.y - a.y;
        let d = Math.sqrt(dx * dx + dy * dy);
        const gap =
          a.group != null && b.group != null && a.group !== b.group ? interPad : pad;
        const min = a.r + b.r + gap;
        if (d >= min) continue;
        if (d < 1e-6) {
          // Exakt deckungsgleich: zufällige Richtung, um die Singularität zu lösen.
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
          d = Math.sqrt(dx * dx + dy * dy) || 1;
        }
        const overlap = min - d;
        const ux = dx / d,
          uy = dy / d;
        if (a.fixed && b.fixed) continue;
        if (a.fixed) {
          b.x += ux * overlap;
          b.y += uy * overlap;
        } else if (b.fixed) {
          a.x -= ux * overlap;
          a.y -= uy * overlap;
        } else {
          const half = overlap * 0.5;
          a.x -= ux * half;
          a.y -= uy * half;
          b.x += ux * half;
          b.y += uy * half;
        }
        moved += overlap;
        if (it === 0) firstEnergy += overlap * overlap;
      }
    }
    if (moved < eps) break;
  }
  return firstEnergy / Math.max(nodes.length, 1);
}
