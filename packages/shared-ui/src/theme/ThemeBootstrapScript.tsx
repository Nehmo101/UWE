"use client";

import type { UweThemePreferences } from "./storage";
import type { AppScope } from "./tokens";
import { buildThemeBootstrapScript } from "./bootstrapScript";

export function ThemeBootstrapScript({
  scope,
  serverPreferences = null,
  serverUpdatedAt = null,
}: {
  scope: AppScope;
  serverPreferences?: UweThemePreferences | null;
  serverUpdatedAt?: string | null;
}) {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: buildThemeBootstrapScript(scope, {
          serverPreferences,
          serverUpdatedAt,
        }),
      }}
    />
  );
}
