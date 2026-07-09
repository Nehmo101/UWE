/** @param {import('./pages-data.mjs').PageAudit} page @param {number|null} roadmapIssue */
export function buildIssueBody(page, roadmapIssue = null) {
  const imp = page.improvements ?? {};
  const p1 = imp.P1 ?? [];
  const p2 = imp.P2 ?? [];
  const p3 = imp.P3 ?? [];

  const files = page.files?.length
    ? page.files.map((f) => `- \`${f}\``).join("\n")
    : `- \`apps/${page.app}/app${page.route === "/" ? "" : page.route.replace(/\[.*?\]/g, "[param]")}/page.tsx\``;

  const roadmapLine = roadmapIssue
    ? `Teil der [UX-Audit Roadmap #${roadmapIssue}](https://github.com/Nehmo101/UWE/issues/${roadmapIssue}).`
    : "Teil der UX-Audit-Roadmap (wird nach Issue-Erstellung verknüpft).";

  return `<!-- ux-audit-issue -->
${roadmapLine}

## Kontext

| Feld | Wert |
|------|------|
| **App** | ${page.app === "studio" ? "Studio (`:3000`)" : "Portal (`:3001`)"} |
| **Route** | \`${page.route}\` |
| **Bereich** | ${page.area} |
| **Komplexität** | ${page.complexity} |
| **Überladung** | ${page.overload}/5 |
| **Top-Priorität** | ${page.topPriority} |
| **Roadmap-Phase** | ${page.phase} |

## Zweck

${page.zweck}

## Aufbau

${page.aufbau}

## Stärken

${(page.staerken ?? []).map((s) => `- ${s}`).join("\n") || "- _(keine dokumentiert)_"}

## Schwächen / Risiken

${(page.schwaechen ?? []).map((s) => `- ${s}`).join("\n") || "- _(keine dokumentiert)_"}

## Verbesserungspotenzial

### P1 (sofort / hoher Impact)
${p1.map((s) => `- ${s}`).join("\n") || "- —"}

### P2 (nächster Sprint)
${p2.map((s) => `- ${s}`).join("\n") || "- —"}

### P3 (Polish / Nice-to-have)
${p3.map((s) => `- ${s}`).join("\n") || "- —"}

## Nächster Schritt (konkret)

${page.nextStep}

## Relevante Dateien

${files}

## Agent-Implementierungshinweise

- Business-Logik in \`packages/\`, nicht in Route Handlers wachsen lassen.
- Neue Dateien max. 700 Zeilen (Anti-Monolith-Gate).
- Bei Auth-Änderungen: \`pnpm test:security\`.
- Vor Merge: \`pnpm ci:light\` (oder betroffenes Package).
- Bestehende Nav-Konstanten: \`apps/studio/src/navigation/\` bzw. \`apps/portal/src/navigation/portal-nav.ts\`.
- Player-Safety (Portal): \`dm_only\` nie exponieren; Filtering in Repository/Service-Layer.

## Akzeptanzkriterien

- [ ] Nächster Schritt umgesetzt
- [ ] Überladung spürbar reduziert oder begründet dokumentiert
- [ ] Keine Regression in Auth/Visibility (Security-Tests grün wenn betroffen)
- [ ] Manuelle QA: Route im Browser mit Demo-Login (\`dm@uwe.local\` / \`uwe-dev\`)

## Verknüpfung

- Label: \`ux-audit\`, \`${page.app === "studio" && page.area.startsWith("Welt") ? "world-cockpit" : page.app}\`, \`phase-${page.phase.toLowerCase()}\`, \`${page.topPriority.toLowerCase()}-priority\`
`;
}

export function buildIssueTitle(page) {
  const appTag =
    page.app === "portal"
      ? "Portal"
      : page.area.startsWith("Welt")
        ? "Welt"
        : "Studio";
  const appPrefix = page.app === "portal" ? "portal:" : page.area.startsWith("Welt") ? "welt:" : "studio:";
  return `[UX-Audit][${appTag}] ${appPrefix}${page.route} — ${page.title} (${page.topPriority})`;
}

export function labelsForPage(page) {
  const labels = ["ux-audit", "enhancement", `${page.topPriority.toLowerCase()}-priority`, `phase-${page.phase.toLowerCase()}`];
  if (page.app === "portal") labels.push("portal");
  else if (page.area.startsWith("Welt")) labels.push("world-cockpit", "studio");
  else labels.push("studio");
  return labels;
}
