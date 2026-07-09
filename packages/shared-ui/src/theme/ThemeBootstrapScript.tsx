"use client";

import type { UweThemePreferences } from "./storage";
import type { AppScope } from "./tokens";
import type { CustomThemeDefinition } from "./themes";
import { buildThemeBootstrapScript } from "./bootstrapScript";

export function ThemeBootstrapScript({
  scope,
  serverPreferences = null,
  serverUpdatedAt = null,
  customThemes,
}: {
  scope: AppScope;
  serverPreferences?: UweThemePreferences | null;
  serverUpdatedAt?: string | null;
  customThemes?: readonly CustomThemeDefinition[];
}) {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: buildThemeBootstrapScript(scope, {
          serverPreferences,
          serverUpdatedAt,
          customThemes,
        }),
      }}
    />
  );
}
