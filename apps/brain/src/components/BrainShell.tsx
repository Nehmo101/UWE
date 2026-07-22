import type { ReactNode } from "react";
import { BrainNav } from "./BrainNav";

/** Presentational shell shared by the Brain surfaces (nav + card + heading).
 *  Owner-gating and data fetching stay in each page (data must not load for
 *  non-owners). */
export function BrainShell({
  active,
  title,
  children,
}: {
  active: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="page">
      <div className="card" style={{ maxWidth: "56rem" }}>
        <BrainNav active={active} />
        <span className="eyebrow">Owner-only · lokal · nie in der Cloud</span>
        <h1>{title}</h1>
        {children}
      </div>
    </main>
  );
}

export function BrainDenied() {
  return <p>Dieser Bereich ist ausschließlich für den System-Owner.</p>;
}
