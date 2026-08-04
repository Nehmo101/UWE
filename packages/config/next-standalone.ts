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
 * Pakete, die zur Laufzeit eigene Dateien relativ zu ihrem `__dirname` lesen
 * und deshalb NIE ins Server-Bundle gezogen werden dürfen (#84).
 *
 * jsdom lädt `browser/default-stylesheet.css` gegen sein eigenes Verzeichnis.
 * Gebündelt zeigt `__dirname` auf das App-Verzeichnis und jede Sanitisierung
 * stirbt mit ENOENT — im Portal bei jeder HTML-Wiki-Seite, im Studio über
 * `sanitize-html.ts`/`html-sanitize.ts`, im Brain über die Mail-Sanitisierung.
 * Der Fix lebt EINMAL hier; alle fünf Apps konsumieren ihn über
 * {@link getUweStandaloneNextConfig} und {@link applyUweWebpackDefaults}.
 *
 * `serverExternalPackages` allein reicht nicht: Workspace-Pakete holen
 * isomorphic-dompurify per `require()`, und webpack bündelt es trotzdem —
 * darum stehen die Namen zusätzlich in den webpack-`externals`.
 */
export const uweServerOnlyHtmlPackages = ["isomorphic-dompurify", "jsdom"] as const;

/** Alles, was serverseitig extern bleiben muss — Prisma-Runtime plus jsdom-Familie. */
export const uweServerExternalModules = [
  ...uwePrismaRuntimePackages,
  ...uweServerOnlyHtmlPackages,
] as const;

interface UweWebpackContext {
  isServer: boolean;
  webpack: { IgnorePlugin: new (options: unknown) => unknown };
}

/**
 * Gemeinsamer webpack-Block der fünf Apps: libsql-Doku-Dateien ignorieren und
 * die Server-Externals eintragen. Eine App mit eigenen Zusätzen ruft das hier
 * zuerst auf und erweitert danach.
 */
export function applyUweWebpackDefaults<
  T extends { plugins: unknown[]; externals?: unknown },
>(config: T, { isServer, webpack }: UweWebpackContext): T {
  config.plugins.push(
    new webpack.IgnorePlugin({
      resourceRegExp: /\.(md|txt)$/,
      contextRegExp: /[\\/]@libsql[\\/]/,
    }),
  );

  if (isServer) {
    config.externals = [
      ...(Array.isArray(config.externals)
        ? config.externals
        : [config.externals].filter(Boolean)),
      ...uweServerExternalModules,
    ];
  }

  return config;
}

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
    serverExternalPackages: [...uweServerExternalModules],
  };
}
