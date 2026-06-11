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
          color: "#94a3b8",
        }}
      >
        Universeller Welten-Editor
      </p>
      <h1
        style={{
          margin: 0,
          fontSize: "2.5rem",
          fontWeight: 700,
          color: "#f1f5f9",
        }}
      >
        {appName}
      </h1>
      {tagline && (
        <p
          style={{
            margin: 0,
            fontSize: "1.125rem",
            color: "#cbd5e1",
            textAlign: "center",
            maxWidth: "32rem",
          }}
        >
          {tagline}
        </p>
      )}
      {children}
    </header>
  );
}
