import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, buttonVariants } from "@/src/components/ui";

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
    <Card>
      <CardHeader>
        <CardTitle>Schnellstart</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {SECTIONS.map((section) => (
          <div key={section.title} className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">{section.title}</h3>
            <div className="flex flex-wrap items-center gap-2">
              {section.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={buttonVariants({ variant: "secondary", size: "sm" })}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
