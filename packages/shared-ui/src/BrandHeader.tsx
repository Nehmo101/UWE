import type { ReactNode } from "react";

interface BrandHeaderProps {
  appName: string;
  tagline?: string;
  children?: ReactNode;
}

export function BrandHeader({ appName, tagline, children }: BrandHeaderProps) {
  return (
    <header
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.5rem",
        marginBottom: "2rem",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "0.875rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--uwe-muted)",
        }}
      >
        Universeller Welten-Editor
      </p>
      <h1
        style={{
          margin: 0,
          fontSize: "2.5rem",
          fontWeight: 700,
          color: "var(--uwe-fg)",
        }}
      >
        {appName}
      </h1>
      {tagline && (
        <p
          style={{
            margin: 0,
            fontSize: "1.125rem",
            color: "var(--uwe-fg)",
            textAlign: "center",
            maxWidth: "32rem",
            opacity: 0.85,
          }}
        >
          {tagline}
        </p>
      )}
      {children}
    </header>
  );
}
