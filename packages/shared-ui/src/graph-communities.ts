// UWE Graph — Community-Erkennung per Label-Propagation.
//
// Bestimmt Grüppchen stark untereinander verbundener Knoten. Die Engine nutzt das
// Ergebnis zweifach: Communities starten im Initial-Layout in benachbarten
// Winkel-Sektoren, und eine sanfte Anziehung zum Community-Schwerpunkt hält sie
// während der Simulation zusammen ("Graph bildet Grüppchen mit den meisten
// Verbindungen").
//
// Framework-agnostisch und deterministisch: Knoten werden nach aufsteigendem Grad
// (Brücken-Knoten zuletzt, damit Labels nicht über Brücken "lecken") und bei
// gleichem Grad nach ID verarbeitet; Gleichstände fallen auf das kleinste Label.

/**
 * Liefert pro Knoten-ID einen kompakten Community-Index (0..k-1, in Reihenfolge
 * des ersten Auftretens in `nodeIds`). Isolierte Knoten bilden eigene Communities.
 */
export function detectCommunities(
  nodeIds: string[],
  adj: Record<string, Set<string>>,
  maxIters = 12,
): Map<string, number> {
  const label = new Map<string, number>();
  nodeIds.forEach((id, index) => label.set(id, index));

  const order = [...nodeIds].sort(
    (a, b) => (adj[a]?.size ?? 0) - (adj[b]?.size ?? 0) || a.localeCompare(b),
  );

  for (let it = 0; it < maxIters; it++) {
    let changed = false;
    for (const id of order) {
      const counts = new Map<number, number>();
      adj[id]?.forEach((nb) => {
        const l = label.get(nb);
        if (l == null) return;
        counts.set(l, (counts.get(l) ?? 0) + 1);
      });
      if (counts.size === 0) continue;
      let best = label.get(id) as number;
      let bestCount = counts.get(best) ?? 0;
      counts.forEach((count, l) => {
        if (count > bestCount || (count === bestCount && l < best)) {
          best = l;
          bestCount = count;
        }
      });
      if (best !== label.get(id)) {
        label.set(id, best);
        changed = true;
      }
    }
    if (!changed) break;
  }

  // Labels auf kompakte Indizes abbilden (stabil über die Eingabe-Reihenfolge).
  const remap = new Map<number, number>();
  const out = new Map<string, number>();
  nodeIds.forEach((id) => {
    const l = label.get(id) as number;
    if (!remap.has(l)) remap.set(l, remap.size);
    out.set(id, remap.get(l) as number);
  });
  return out;
}
