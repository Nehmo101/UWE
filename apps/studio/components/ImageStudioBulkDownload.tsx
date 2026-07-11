"use client";

interface VersionAsset {
  id: string;
  versionNumber: number;
  assetId: string | null;
}

interface Props {
  projectId: string;
  versions: VersionAsset[];
}

export function ImageStudioBulkDownload({ projectId, versions }: Props) {
  const assets = versions.filter((version) => version.assetId);

  if (assets.length === 0) {
    return null;
  }

  function downloadAll() {
    for (const version of assets) {
      if (!version.assetId) continue;
      const link = document.createElement("a");
      link.href = `/api/assets/${version.assetId}/file`;
      link.download = `${projectId}-v${version.versionNumber}`;
      link.target = "_blank";
      link.rel = "noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  }

  return (
    <button type="button" className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] px-4 py-2 text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-8 px-3 text-xs" onClick={downloadAll}>
      Alle Versionen herunterladen ({assets.length})
    </button>
  );
}
