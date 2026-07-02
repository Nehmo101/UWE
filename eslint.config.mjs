import { fileURLToPath } from "node:url";
import path from "node:path";

import { FlatCompat } from "@eslint/eslintrc";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({
  baseDirectory: repoRoot,
});

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
      "**/dist/**",
      "**/.turbo/**",
      "**/src-tauri/target/**",
      "packages/database/src/generated/**",
      "design-system/_ds_bundle.js",
      "data/**",
      "exports/**",
      "**/*.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    settings: {
      next: {
        rootDir: ["apps/studio/", "apps/portal/"],
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
    },
  },
];

export default config;
