"use client";

import dynamic from "next/dynamic";

const AtlasStudioWorkspace = dynamic(
  () => import("./AtlasStudioWorkspace").then((module) => module.AtlasStudioWorkspace),
  {
    loading: () => (
      <p className="uwe-dashboard-muted" role="status">
        Atlas-Editor wird geladen…
      </p>
    ),
    ssr: false,
  },
);

export { AtlasStudioWorkspace as AtlasStudioWorkspaceLazy };
