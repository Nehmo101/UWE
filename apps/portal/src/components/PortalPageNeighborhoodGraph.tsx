import Link from "next/link";
import { GraphView } from "@uwe/shared-ui";
import { buildPageGraph, getAppRepository } from "@uwe/database/server";
import { remapPortalGraphHrefs } from "@/src/lib/portal-graph";

interface PortalPageNeighborhoodGraphProps {
  worldSlug: string;
  pageId: string;
}

export async function PortalPageNeighborhoodGraph({
  worldSlug,
  pageId,
}: PortalPageNeighborhoodGraphProps) {
  const repo = getAppRepository();
  const pageGraph = await buildPageGraph(repo, worldSlug, pageId, "portal", "neighbors");
  const nodes = remapPortalGraphHrefs(worldSlug, pageGraph.nodes);

  return (
    <section className="wiki-graph-section mt-8">
      <div className="wiki-graph-head mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Nachbarschafts-Graph</h2>
        <Link
          className="text-sm hover:underline"
          href={`/auth/worlds/${worldSlug}/graph?focusPageId=${encodeURIComponent(pageId)}&mode=neighbors`}
        >
          Im Beziehungsnetz öffnen →
        </Link>
      </div>
      <GraphView nodes={nodes} edges={pageGraph.edges} height={320} />
    </section>
  );
}
