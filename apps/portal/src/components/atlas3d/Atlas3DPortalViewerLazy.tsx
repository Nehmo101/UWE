"use client";

import dynamic from "next/dynamic";
import type { Atlas3DPortalViewerProps } from "./Atlas3DPortalViewer";
import "./atlas3d-portal.css";

/** three.js loads only on the atlas3d route, client-side. */
const Atlas3DPortalViewer = dynamic(
  () => import("./Atlas3DPortalViewer").then((m) => m.Atlas3DPortalViewer),
  { ssr: false, loading: () => <div className="atlas3d-portal-loading">3D-Karte lädt …</div> },
);

export function Atlas3DPortalViewerLazy(props: Atlas3DPortalViewerProps) {
  return <Atlas3DPortalViewer {...props} />;
}
