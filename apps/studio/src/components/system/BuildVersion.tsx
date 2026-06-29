import { formatBuildLabel, type BuildInfo } from "@/src/lib/build-info";

/** Compact version label for shell footers (server component). */
export function BuildVersionFooter({ info }: { info: BuildInfo }) {
  return (
    <a href="/system/version" className="hover:underline" title="Version & Updates">
      {formatBuildLabel(info)}
    </a>
  );
}
