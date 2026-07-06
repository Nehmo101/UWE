import type { ReactNode } from "react";

export function AdminCreateCard({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`uwe-v2-card uwe-v2-card-padded uwe-v2-section${className ? ` ${className}` : ""}`}>
      <h2 className="uwe-v2-section-title">{title}</h2>
      {children}
    </section>
  );
}
