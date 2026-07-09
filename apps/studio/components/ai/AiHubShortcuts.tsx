import Link from "next/link";

const SECTIONS = [
  {
    title: "DnD & Welten",
    links: [
      { href: "/worlds", label: "Welten & Generator" },
      { href: "/brain", label: "DnD-Brain" },
    ],
  },
  {
    title: "Personal",
    links: [
      { href: "/life-brain/chat", label: "Life-Brain Chat" },
      { href: "/life-brain", label: "Life-Brain Hub" },
    ],
  },
  {
    title: "Admin & Jobs",
    links: [
      { href: "/admin/ai-gateway", label: "KI-Gateway" },
      { href: "/admin/agent-jobs", label: "Agent Jobs" },
      { href: "/jobs", label: "Job-Warteschlange" },
    ],
  },
] as const;

export function AiHubShortcuts() {
  return (
    <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
      <h2 className="uwe-v2-section-title">Schnellstart</h2>
      <div className="uwe-ai-hub-sections">
        {SECTIONS.map((section) => (
          <div key={section.title} className="uwe-ai-hub-section">
            <h3 className="uwe-section-subtitle">{section.title}</h3>
            <div className="uwe-inline-actions">
              {section.links.map((link) => (
                <Link key={link.href} href={link.href} className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
