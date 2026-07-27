import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/auth";
import { canEnterBrain } from "@/src/lib/owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";

export const dynamic = "force-dynamic";

const QUICK_LINKS: Array<{ href: string; title: string; desc: string; icon: string }> = [
  { href: "/today", title: "Heute", desc: "Überblick & Kennzahlen", icon: "☀" },
  { href: "/capture", title: "Capture", desc: "Schnell erfassen", icon: "✎" },
  { href: "/life-brain", title: "Wissen", desc: "Fakten & Dokumente", icon: "✦" },
  { href: "/projects", title: "Projekte", desc: "Vorhaben & Schritte", icon: "▤" },
  { href: "/workshop", title: "Werkstatt", desc: "Miniaturen, 3D-Druck", icon: "⚒" },
  { href: "/contracts", title: "Verträge", desc: "Abos & Ausgaben", icon: "€" },
  { href: "/hardware", title: "Hardware", desc: "Geräte & Homelab", icon: "▣" },
  { href: "/documents", title: "Dokumente", desc: "Vorlagen & Guides", icon: "▦" },
];

export default async function BrainHome() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  if (!canEnterBrain(user)) {
    return (
      <BrainShell active="/" title="UWE Brain">
        <BrainDenied />
      </BrainShell>
    );
  }

  return (
    <BrainShell
      active="/"
      title="UWE Brain"
      lede="Dein privater Alltags- und Wissensbereich — Daily Admin OS und Personal Brain, lokal auf deiner Hardware. Owner-gesichert; online nur nach Owner-Login."
    >
      <div
        style={{
          display: "grid",
          gap: "0.85rem",
          gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 1fr))",
        }}
      >
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="brain-card"
            style={{ textDecoration: "none", color: "inherit", display: "grid", gap: "0.3rem" }}
          >
            <span style={{ fontSize: "1.4rem", color: "var(--uwe-accent)" }} aria-hidden>
              {link.icon}
            </span>
            <strong>{link.title}</strong>
            <span className="brain-muted">{link.desc}</span>
          </Link>
        ))}
      </div>
    </BrainShell>
  );
}
