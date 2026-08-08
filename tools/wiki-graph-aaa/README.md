# Wiki-Graph AAA harness

Local visual/perf harness for the shared `@uwe/shared-ui` graph engine
(Studio „Verbindungen / Graph“ and Portal „Beziehungsnetz“).

## Commands

```bash
# Progress dashboard (http://127.0.0.1:4177/progress.html)
node tools/wiki-graph-aaa/harness.mjs --serve-only

# Rebuild engine bundle + capture before/after style shots
node tools/wiki-graph-aaa/capture-after-render.mjs
node tools/wiki-graph-aaa/capture-motion.mjs
node tools/wiki-graph-aaa/capture-chrome-react.mjs
node tools/wiki-graph-aaa/measure-raf.mjs
node tools/wiki-graph-aaa/check-perf-raf.mjs
```

Generated bundles, PNG shots, and Obsidian reference images are gitignored —
recreate them with the scripts above (Playwright + esbuild required).
