"use client";

import dynamic from "next/dynamic";
import type { Atlas3DEditorShellProps } from "./Atlas3DEditorShell";

/**
 * three.js stays out of the shared bundle: the editor loads only on the
 * atlas3d route, client-side (no SSR — WebGL needs a real canvas).
 */
const Atlas3DEditorShell = dynamic(
  () => import("./Atlas3DEditorShell").then((m) => m.Atlas3DEditorShell),
  { ssr: false, loading: () => <div className="atlas3d-loading">Atlas 3D lädt …</div> },
);

export function Atlas3DEditorLazy(props: Atlas3DEditorShellProps) {
  return <Atlas3DEditorShell {...props} />;
}
