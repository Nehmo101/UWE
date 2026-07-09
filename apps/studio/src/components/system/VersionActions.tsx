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
      <Link href="/system/whats-new" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
        Changelog öffnen
      </Link>
    </div>
  );
}
