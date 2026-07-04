import Link from "next/link";
import type { ChangelogRelease } from "@/src/lib/changelog";
import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { EmptyState } from "@/src/components/ui/states";
import { cn } from "@/src/components/ui/cn";

const SECTION_LABEL: Record<string, string> = {
  Added: "Neu",
  Changed: "Geändert",
  Deprecated: "Veraltet",
  Removed: "Entfernt",
  Fixed: "Behoben",
  Security: "Sicherheit",
};

function sectionLabel(kind: string): string {
  return SECTION_LABEL[kind] ?? kind;
}

/** Render inline **bold** segments from changelog bullet text. */
function ChangelogItemText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}

function formatReleaseDate(date: string | null): string | null {
  if (!date) return null;
  const parsed = Date.parse(date);
  if (Number.isNaN(parsed)) return date;
  return new Date(parsed).toLocaleDateString("de-DE", { dateStyle: "long" });
}

export interface ReleaseNotesProps {
  releases: ChangelogRelease[];
  /** Installed app version — highlights the matching release card. */
  currentVersion?: string;
}

export function ReleaseNotes({ releases, currentVersion }: ReleaseNotesProps) {
  if (releases.length === 0) {
    return (
      <EmptyState
        icon="book-open"
        title="Keine Release Notes gefunden"
        description="CHANGELOG.md ist in dieser Umgebung nicht verfügbar (z. B. Standalone-Build ohne Repo-Quelle)."
      />
    );
  }

  const normalizedCurrent = currentVersion?.replace(/^v/i, "").trim();

  return (
    <div className="flex flex-col gap-4">
      {releases.map((release) => {
        const isCurrent =
          normalizedCurrent &&
          !release.unreleased &&
          release.version.replace(/^v/i, "").trim() === normalizedCurrent;
        const dateLabel = formatReleaseDate(release.date);

        return (
          <Card
            key={release.version}
            className={cn(isCurrent && "border-primary/50 ring-1 ring-primary/20")}
          >
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">
                  {release.unreleased ? "Unreleased" : `Version ${release.version}`}
                </CardTitle>
                {release.unreleased ? (
                  <Badge variant="info">In Entwicklung</Badge>
                ) : null}
                {isCurrent ? <Badge variant="success">Aktuelle Version</Badge> : null}
                {dateLabel ? (
                  <span className="text-sm text-muted-foreground">{dateLabel}</span>
                ) : null}
                {release.url ? (
                  <Link
                    href={release.url}
                    className="text-sm text-primary hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Release ansehen →
                  </Link>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-0">
              {release.sections.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Einträge in diesem Release.</p>
              ) : (
                release.sections.map((section) => (
                  <section key={`${release.version}-${section.kind}`}>
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {sectionLabel(section.kind)}
                    </h3>
                    <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                      {section.items.map((item, index) => (
                        <li key={`${section.kind}-${index}`}>
                          <ChangelogItemText text={item} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
