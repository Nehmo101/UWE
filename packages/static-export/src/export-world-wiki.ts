import fs from "node:fs";
import path from "node:path";
import {
  buildPageUrl,
  buildPageView,
  isPageAccessible,
  type AccessContext,
  type UweRepository,
} from "@uwe/database/server";
import {
  auditStaticExport,
  StaticExportSecurityError,
  type StaticExportAuditIssue,
} from "./export-world";

export type WikiExportFormat = "markdown" | "html";

export interface WikiExportOptions {
  worldSlug: string;
  outputDir: string;
  format: WikiExportFormat;
  /** Defaults to portal — dm_only content is excluded unless context is dm/studio. */
  context?: AccessContext;
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
  visibility: string;
  publishStatus: string;
  tags: string[];
}): string {
  const lines = [
    "---",
    `title: ${escapeYaml(input.title)}`,
    `slug: ${input.slug}`,
    `type: ${input.type}`,
    `visibility: ${input.visibility}`,
    `publish_status: ${input.publishStatus}`,
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
  const context = options.context ?? "portal";
  const world = await repo.getWorldBySlug(options.worldSlug);
  if (!world) {
    throw new Error(`World not found: ${options.worldSlug}`);
  }

  const outputDir = path.resolve(options.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });

  const pages = await repo.listPagesForContext(options.worldSlug, context);
  const allPages = await repo.getWorldPageIndex(options.worldSlug);
  const hiddenPages = allPages.filter((page) => !isPageAccessible(page, context));
  const writtenFiles: string[] = [];

  for (const page of pages) {
    const view = await buildPageView(repo, options.worldSlug, page.slug, context);
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
          visibility: view.page.visibility,
          publishStatus: view.page.publishStatus,
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
    context,
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

  const issues = auditStaticExport(outputDir, hiddenPages, pages);
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
