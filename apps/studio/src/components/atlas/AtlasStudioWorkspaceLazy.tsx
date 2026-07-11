"use client";

import dynamic from "next/dynamic";

const AtlasStudioWorkspace = dynamic(
  () => import("./AtlasStudioWorkspace").then((module) => module.AtlasStudioWorkspace),
  {
    loading: () => (
      <p className="text-sm text-muted-foreground" role="status">
        Atlas-Editor wird geladen…
      </p>
    ),
    ssr: false,
  },
);

export { AtlasStudioWorkspace as AtlasStudioWorkspaceLazy };
