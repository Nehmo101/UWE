# Performance Improvement — Startup Prompt

Paste this into a fresh Claude Code session in `/opt/uwe` to start executing
[`performance-improvement-plan.md`](./performance-improvement-plan.md).

```
Lies docs/engineering/performance-improvement-plan.md — das ist unser
Arbeitsplan für die Performance-Verbesserung von UWE.

Setup zuerst:
1. Baseline messen: `UWE_STRESS_SCALE=mega pnpm db:seed:stress` und dann
   `pnpm test` laufen lassen. Notier die Ist-Werte für searchQuery,
   searchIndexBuild, listPages und todaySummary aus perf-budgets.ts als
   Ausgangspunkt.

Dann WS1 umsetzen (React cache() für Request-Level-Dedup):
- Finde die echten Exports für Session-/AccessContext-/World-by-Slug-Auflösung
  in @uwe/auth und dem database-Service-Layer (nicht raten — grep/lesen).
- Wrappe sie in `cache` aus "react". Keine Verhaltensänderung.
- Verifiziere mit einem temporären Query-Count-Log unter dem mega-Seed, dass
  jeder Resolver pro Request nur einmal läuft.

Regeln:
- Ein PR pro Workstream, jeder einzeln revertierbar.
- Vor jedem PR: `pnpm ci:light` muss grün sein, plus die Perf-Tests.
- Bei WS3 (Authz in SQL): `pnpm test:security`, `test:authz`, `test:leaks`
  MÜSSEN grün bleiben — das ist der korrektheitskritische Teil.
- Branch anlegen, nicht direkt auf main. Erst committen/pushen wenn ich es sage.

Starte mit der Baseline-Messung und WS1. Zeig mir die Vorher/Nachher-Zahlen.
```
