"use client";

import { useMemo, useState } from "react";

type DiffKind = "unchanged" | "added" | "removed";

interface DiffLine {
  kind: DiffKind;
  text: string;
}

interface DiffHunk {
  kind: DiffKind;
  lines: string[];
}

const COLLAPSE_THRESHOLD = 4;

function computeLineDiff(original: string, edited: string): DiffLine[] {
  const aLines = original.split("\n");
  const bLines = edited.split("\n");
  const n = aLines.length;
  const m = bLines.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] =
        aLines[i] === bLines[j]
          ? 1 + dp[i + 1][j + 1]
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (aLines[i] === bLines[j]) {
      result.push({ kind: "unchanged", text: aLines[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ kind: "removed", text: aLines[i] });
      i += 1;
    } else {
      result.push({ kind: "added", text: bLines[j] });
      j += 1;
    }
  }
  while (i < n) {
    result.push({ kind: "removed", text: aLines[i] });
    i += 1;
  }
  while (j < m) {
    result.push({ kind: "added", text: bLines[j] });
    j += 1;
  }
  return result;
}

function groupIntoHunks(lines: DiffLine[]): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  for (const line of lines) {
    const last = hunks[hunks.length - 1];
    if (last && last.kind === line.kind) {
      last.lines.push(line.text);
    } else {
      hunks.push({ kind: line.kind, lines: [line.text] });
    }
  }
  return hunks;
}

interface Props {
  original: string;
  edited: string;
}

export function PageReviewDiffView({ original, edited }: Props) {
  const [expandedHunks, setExpandedHunks] = useState<Set<number>>(() => new Set());
  const hunks = useMemo(
    () => groupIntoHunks(computeLineDiff(original, edited)),
    [original, edited],
  );

  const changedLines = hunks.reduce(
    (count, hunk) => count + (hunk.kind === "unchanged" ? 0 : hunk.lines.length),
    0,
  );

  if (original === edited) {
    return <p className="text-sm text-muted-foreground">Keine Änderungen gegenüber dem Original.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {changedLines} geänderte Zeile{changedLines === 1 ? "" : "n"} — unveränderte Abschnitte sind
        eingeklappt.
      </p>
      <div
        className="max-h-[480px] overflow-auto rounded-md border border-border bg-muted/20 font-mono text-xs"
        role="region"
        aria-label="Text-Diff"
      >
        {hunks.map((hunk, index) => {
          const isCollapsible =
            hunk.kind === "unchanged" && hunk.lines.length >= COLLAPSE_THRESHOLD;
          const isExpanded = expandedHunks.has(index);

          if (isCollapsible && !isExpanded) {
            return (
              <button
                key={`hunk-${index}`}
                type="button"
                className="block w-full border-b border-border/50 px-3 py-1.5 text-left text-muted-foreground hover:bg-muted/40"
                onClick={() => {
                  setExpandedHunks((prev) => new Set(prev).add(index));
                }}
              >
                … {hunk.lines.length} unveränderte Zeilen anzeigen …
              </button>
            );
          }

          return (
            <div key={`hunk-${index}`} className="border-b border-border/50 last:border-b-0">
              {hunk.lines.map((line, lineIndex) => (
                <div
                  key={`${index}-${lineIndex}`}
                  className={
                    hunk.kind === "added"
                      ? "bg-emerald-500/10 px-3 py-0.5"
                      : hunk.kind === "removed"
                        ? "bg-red-500/10 px-3 py-0.5"
                        : "px-3 py-0.5 text-muted-foreground"
                  }
                >
                  <span className="mr-2 select-none opacity-60">
                    {hunk.kind === "added" ? "+" : hunk.kind === "removed" ? "−" : " "}
                  </span>
                  {line || " "}
                </div>
              ))}
              {isCollapsible && isExpanded && (
                <button
                  type="button"
                  className="block w-full px-3 py-1 text-left text-muted-foreground hover:bg-muted/40"
                  onClick={() => {
                    setExpandedHunks((prev) => {
                      const next = new Set(prev);
                      next.delete(index);
                      return next;
                    });
                  }}
                >
                  Abschnitt einklappen
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
