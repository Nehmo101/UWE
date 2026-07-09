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
    <button type="button" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm" onClick={downloadAll}>
      Alle Versionen herunterladen ({assets.length})
    </button>
  );
}
