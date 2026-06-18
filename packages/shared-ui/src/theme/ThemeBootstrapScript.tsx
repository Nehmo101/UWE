"use client";

import type { AppScope } from "./tokens";
import { buildThemeBootstrapScript } from "./bootstrapScript";

export function ThemeBootstrapScript({ scope }: { scope: AppScope }) {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: buildThemeBootstrapScript(scope) }}
    />
  );
}
