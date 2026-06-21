import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
export const uweMonorepoRoot = path.resolve(configDir, "../..");

/** Runtime packages required by @uwe/database that must resolve in standalone output. */
export const uwePrismaRuntimePackages = [
  "@libsql/client",
  "@prisma/adapter-libsql",
  "@prisma/adapter-pg",
  "@prisma/client",
  "libsql",
  "pg",
  "better-sqlite3",
] as const;

/**
 * Monorepo-safe standalone tracing for Next.js apps that depend on @uwe/database.
 * Paths in outputFileTracingIncludes are relative to the app directory (apps/studio|portal).
 */
export function getUweStandaloneNextConfig(appDir: string) {
  const appRelativeToRoot = path.relative(appDir, uweMonorepoRoot);
  const rootPrefix =
    appRelativeToRoot.length === 0 ? "." : appRelativeToRoot.split(path.sep).join("/");

  const fromRoot = (segment: string): string =>
    rootPrefix === "." ? segment : `${rootPrefix}/${segment}`;

  const tracingIncludes = [
    fromRoot("packages/database/src/generated/**/*"),
    fromRoot("packages/database/prisma/**/*"),
    fromRoot("node_modules/@libsql/client/**/*"),
    fromRoot("node_modules/@prisma/adapter-libsql/**/*"),
    fromRoot("node_modules/@prisma/adapter-pg/**/*"),
    fromRoot("node_modules/@prisma/client/**/*"),
    fromRoot("node_modules/libsql/**/*"),
    fromRoot("node_modules/pg/**/*"),
    fromRoot("node_modules/pg-*/**/*"),
    fromRoot("node_modules/.pnpm/@libsql+client@*/node_modules/@libsql/client/**/*"),
    fromRoot("node_modules/.pnpm/@prisma+adapter-libsql@*/node_modules/@prisma/adapter-libsql/**/*"),
    fromRoot("node_modules/.pnpm/@prisma+adapter-pg@*/node_modules/@prisma/adapter-pg/**/*"),
    fromRoot("node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/**/*"),
    fromRoot("node_modules/.pnpm/libsql@*/node_modules/libsql/**/*"),
    fromRoot("node_modules/.pnpm/pg@*/node_modules/pg/**/*"),
  ];

  return {
    outputFileTracingRoot: uweMonorepoRoot,
    outputFileTracingIncludes: {
      "/**/*": tracingIncludes,
    },
    serverExternalPackages: [...uwePrismaRuntimePackages],
  };
}
