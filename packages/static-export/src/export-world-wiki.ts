import fs from "node:fs";
import path from "node:path";
import { filterPagesForViewer } from "@uwe/auth";
import {
  buildPageUrl,
  buildPageView,
  type UweRepository,
} from "@uwe/database/server";
import {
  auditStaticExport,
  StaticExportSecurityError,
  type StaticExportAuditIssue,
} from "./export-world";
import { staticExportViewerContext } from "./viewer-context";

export type WikiExportFormat = "markdown" | "html";

export interface WikiExportOptions {
  worldSlug: string;
  outputDir: string;
  format: WikiExportFormat;
}

export interface WikiExportResult {
  outputDir: string;
  worldSlug: string;
  format: WikiExportFormat;
  pageCount: number;
  files: string[];
}

function escapeYaml(value: string): string {
  if (/[:#\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}

function pageMarkdownFrontmatter(input: {
  title: string;
  slug: string;
  type: string;
  tags: string[];
}): string {
  const lines = [
    "---",
    `title: ${escapeYaml(input.title)}`,
    `slug: ${input.slug}`,
    `type: ${input.type}`,
  ];

  if (input.tags.length > 0) {
    lines.push(`tags: [${input.tags.map((tag) => escapeYaml(tag)).join(", ")}]`);
  }

  lines.push("---", "");
  return lines.join("\n");
}

function renderWikiHtmlPage(input: {
  worldName: string;
  pageTitle: string;
  body: string;
}): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(input.pageTitle)} — ${escapeHtml(input.worldName)}</title>
</head>
<body>
  <article>
    <h1>${escapeHtml(input.pageTitle)}</h1>
    <div class="wiki-content">${input.body}</div>
  </article>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function exportWorldWiki(
  repo: UweRepository,
  options: WikiExportOptions,
): Promise<WikiExportResult> {
  const world = await repo.getWorldBySlug(options.worldSlug);
  if (!world) {
    throw new Error(`World not found: ${options.worldSlug}`);
  }
  if (world.isSandbox) {
    throw new Error(`Sandbox world "${options.worldSlug}" cannot be exported.`);
  }

  const outputDir = path.resolve(options.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });

  // Der Export verlässt den Server — er zeigt die Spielersicht: nur
  // freigegebene Seiten, ohne DM-Bereiche (siehe `staticExportViewerContext`).
  const viewer = staticExportViewerContext(world.id);
  const allPages = await repo.listPagesForWorldIndex(options.worldSlug);
  const pages = filterPagesForViewer(viewer, allPages);
  const unreleasedSlugs = allPages
    .filter((page) => !pages.includes(page))
    .map((page) => page.slug);
  const writtenFiles: string[] = [];

  for (const page of pages) {
    const view = await buildPageView(repo, options.worldSlug, page.slug, viewer);
    if (!view) continue;

    const body = view.page.content;
    const relativePath =
      options.format === "markdown" ? `${page.slug}.md` : `${page.slug}.html`;
    const absolutePath = path.join(outputDir, relativePath);

    if (options.format === "markdown") {
      const markdown = [
        pageMarkdownFrontmatter({
          title: view.page.title,
          slug: view.page.slug,
          type: view.page.type,
          tags: view.page.tags,
        }),
        body,
        "",
      ].join("\n");
      fs.writeFileSync(absolutePath, markdown, "utf8");
    } else {
      const html = renderWikiHtmlPage({
        worldName: world.name,
        pageTitle: view.page.title,
        body: escapeHtml(body).replace(/\n/g, "<br>\n"),
      });
      fs.writeFileSync(absolutePath, html, "utf8");
    }

    writtenFiles.push(relativePath);
  }

  const manifest = {
    worldSlug: options.worldSlug,
    worldName: world.name,
    format: options.format,
    exportedAt: new Date().toISOString(),
    pages: pages.map((page) => ({
      title: page.title,
      slug: page.slug,
      href: buildPageUrl(options.worldSlug, page.type, page.slug),
    })),
  };

  const manifestPath = path.join(outputDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  writtenFiles.push("manifest.json");

  const issues = auditStaticExport(outputDir, { unreleasedSlugs });
  if (issues.length > 0) {
    throw new StaticExportSecurityError(issues);
  }

  return {
    outputDir,
    worldSlug: options.worldSlug,
    format: options.format,
    pageCount: pages.length,
    files: writtenFiles,
  };
}

export type { StaticExportAuditIssue };
