import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * Flat ESLint config for the whole UWE monorepo.
 *
 * - Next.js rules (core-web-vitals + TypeScript) apply to both apps.
 * - Shared packages are linted with the same TypeScript rules.
 * - Run with `pnpm lint` from the repo root.
 */
const config = [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      // Agent worktrees (Claude Code / Cursor) must never be linted by the
      // parent checkout — root-relative ignores like
      // design-system/_ds_bundle.js don't match their copies.
      ".claude/**",
      ".worktrees/**",
      ".orca-worktrees/**",
      ".codex-worktrees/**",
      ".vertragus-worktrees/**",
      "**/dist/**",
      "**/.turbo/**",
      "**/src-tauri/target/**",
      "packages/database/src/generated/**",
      "design-system/_ds_bundle.js",
      // Fremdcode: terra/vendor/ traegt three unveraendert aus (siehe
      // terra/vendor/HERKUNFT.md und .gitattributes). Gelintet wird nur, was
      // hier geschrieben wurde.
      "terra/vendor/**",
      // Build-Artefakt: `scripts/copy-terra.mjs` legt terra/ zur Auslieferung in
      // beide Apps. Gelintet wird die QUELLE unter terra/, nicht die Kopie —
      // sonst meldete jeder Fund doppelt (J1).
      "apps/*/public/terra/**",
      "data/**",
      "exports/**",
      "**/*.d.ts",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    settings: {
      next: {
        rootDir: ["apps/studio/", "apps/portal/", "apps/brain/", "apps/family/", "apps/landing/"],
      },
    },
    rules: {
      // node:test suites and server actions legitimately use unused-looking params.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // eslint-config-next 16 bringt eslint-plugin-react-hooks v7 mit, und damit
      // den Regelsatz des React Compilers. Der findet im Bestand rund 90 Stellen
      // — ganz ueberwiegend `set-state-in-effect`, also useEffect-Bloecke, die
      // synchron setState rufen. Das sind keine Fehler im heutigen Verhalten,
      // aber sie kosten Renderdurchlaeufe.
      //
      // Sie stehen bewusst auf "warn" statt "error": als Fehler wuerden sie das
      // Upgrade blockieren, als "off" waeren sie unsichtbar. Das Warnungsbudget
      // in `pnpm lint` (--max-warnings) friert den Bestand ein — wie
      // scripts/file-size-baseline.json bei den Dateigroessen. Neue Verstoesse
      // brechen die CI, der Bestand kann Stueck fuer Stueck abgetragen werden.
      // Danach das Budget senken, nie anheben.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/incompatible-library": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
];

export default config;
