"use client";

import Link from "next/link";
import { CopyToClipboardButton } from "@uwe/shared-ui";
import type { BuildInfo } from "@/src/lib/build-info";

function formatVersionLabel(info: BuildInfo): string {
  const commit = info.commit ? ` · ${info.commit.slice(0, 7)}` : "";
  return `v${info.version}${commit}`;
}

export function VersionActions({ info }: { info: BuildInfo }) {
  const versionLabel = formatVersionLabel(info);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CopyToClipboardButton text={versionLabel} label="Version kopieren" />
      <Link href="/system/whats-new" className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] px-4 py-2 text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-8 px-3 text-xs">
        Changelog öffnen
      </Link>
    </div>
  );
}
