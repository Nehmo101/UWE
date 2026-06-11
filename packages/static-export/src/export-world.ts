import fs from "node:fs";
import path from "node:path";
import {
  buildPageUrl,
  buildPageView,
  isPageAccessible,
  navCategoryForPageType,
  type UweRepository,
} from "@uwe/database/server";
import {
  collectUploadReferences,
  copyReferencedAssets,
  writeBundledAssets,
} from "./assets";
import {
  portalUrlToStaticHref,
  staticExportCategoryForPageType,
  staticPageDir,
} from "./paths";
import { buildSearchIndex } from "./search-index";
import {
  renderStaticPage,
  renderWorldIndexPage,
  rewriteViewForStatic,
  type StaticNavItem,
} from "./templates";

export interface StaticExportOptions {
  worldSlug: string;
  outputDir: string;
  uploadsDir?: string;
}

export interface StaticExportResult {
  outputDir: string;
  worldSlug: string;
  pageCount: number;
  assetCount: number;
  files: string[];
}

export interface StaticExportAuditIssue {
  file: string;
  reason: string;
  snippet?: string;
}

export async function exportWorldStatic(
  repo: UweRepository,
  options: StaticExportOptions,
): Promise<StaticExportResult> {
  const world = await repo.getWorldBySlug(options.worldSlug);
  if (!world) {
    throw new Error(`World not found: ${options.worldSlug}`);
  }

  const outputDir = path.resolve(options.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });

  const pages = await repo.listPagesForContext(options.worldSlug, "portal");
  const allPages = await repo.getWorldPageIndex(options.worldSlug);
  const hiddenPages = allPages.filter((page) => !isPageAccessible(page, "portal"));

  const navItems: StaticNavItem[] = pages.map((page) => ({
    title: page.title,
    href: buildPageUrl(options.worldSlug, page.type, page.slug),
    category: staticExportCategoryForPageType(page.type),
    navCategory: navCategoryForPageType(page.type),
  }));

  writeBundledAssets(outputDir);

  const writtenFiles: string[] = [];
  const uploadRefs = new Set<string>();

  for (const page of pages) {
    const view = await buildPageView(repo, options.worldSlug, page.slug, "portal");
    if (!view) continue;

    const category = staticExportCategoryForPageType(page.type);
    const pageDir = staticPageDir(category, page.slug);
    const absolutePageDir = path.join(outputDir, pageDir);
    fs.mkdirSync(absolutePageDir, { recursive: true });

    const rewritten = rewriteViewForStatic(view, pageDir, options.worldSlug);
    for (const ref of collectUploadReferences(view.page.content)) {
      uploadRefs.add(ref);
    }

    const html = renderStaticPage({
      worldName: world.name,
      worldDescription: world.description,
      pageTitle: view.page.title,
      pageTags: view.page.tags,
      html: rewritten.html,
      backlinks: rewritten.backlinks,
      relatedPages: rewritten.relatedPages,
      navItems,
      currentDir: pageDir,
      worldSlug: options.worldSlug,
    });

    const pageFile = path.join(absolutePageDir, "index.html");
    fs.writeFileSync(pageFile, html, "utf8");
    writtenFiles.push(path.relative(outputDir, pageFile));
  }

  const indexPages = pages.map((page) => {
    const category = staticExportCategoryForPageType(page.type);
    return {
      title: page.title,
      href: portalUrlToStaticHref(
        buildPageUrl(options.worldSlug, page.type, page.slug),
        options.worldSlug,
      ),
      summary: page.summary,
      category,
    };
  });

  const indexHtml = renderWorldIndexPage({
    worldName: world.name,
    worldDescription: world.description,
    pages: indexPages,
    navItems,
    worldSlug: options.worldSlug,
  });

  const indexFile = path.join(outputDir, "index.html");
  fs.writeFileSync(indexFile, indexHtml, "utf8");
  writtenFiles.unshift("index.html");

  const searchIndex = buildSearchIndex(pages);
  const searchIndexFile = path.join(outputDir, "search-index.json");
  fs.writeFileSync(searchIndexFile, JSON.stringify(searchIndex, null, 2), "utf8");
  writtenFiles.push("search-index.json");

  let assetCount = 2;
  if (options.uploadsDir && uploadRefs.size > 0) {
    const copied = copyReferencedAssets(
      [...uploadRefs],
      options.uploadsDir,
      path.join(outputDir, "assets"),
    );
    assetCount += copied.length;
    writtenFiles.push(...copied);
  }

  const issues = auditStaticExport(outputDir, hiddenPages, pages);
  if (issues.length > 0) {
    throw new StaticExportSecurityError(issues);
  }

  return {
    outputDir,
    worldSlug: options.worldSlug,
    pageCount: pages.length,
    assetCount,
    files: writtenFiles,
  };
}

export class StaticExportSecurityError extends Error {
  constructor(public readonly issues: StaticExportAuditIssue[]) {
    super(`Static export failed security audit (${issues.length} issue(s))`);
    this.name = "StaticExportSecurityError";
  }
}

export function auditStaticExport(
  outputDir: string,
  hiddenPages: { title: string; slug: string }[],
  exportedPages: { slug: string }[],
): StaticExportAuditIssue[] {
  const issues: StaticExportAuditIssue[] = [];
  const exportedSlugs = new Set(exportedPages.map((page) => page.slug.toLocaleLowerCase("de")));

  for (const hidden of hiddenPages) {
    if (exportedSlugs.has(hidden.slug.toLocaleLowerCase("de"))) {
      issues.push({
        file: hidden.slug,
        reason: "Hidden page was included in export",
      });
    }
  }

  const forbiddenTerms = hiddenPages.flatMap((page) => [
    page.title,
    page.slug,
  ]);

  const files = listExportFiles(outputDir);

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const relative = path.relative(outputDir, file);

    for (const term of forbiddenTerms) {
      if (!term || term.length < 3) continue;
      if (content.includes(term)) {
        issues.push({
          file: relative,
          reason: `Forbidden hidden content reference: ${term}`,
          snippet: term,
        });
      }
    }

    if (relative.endsWith(".json") && containsSecretLikeFields(content)) {
      issues.push({
        file: relative,
        reason: "JSON file may contain secret metadata",
      });
    }
  }

  return issues;
}

function listExportFiles(outputDir: string): string[] {
  const results: string[] = [];

  function walk(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (/\.(html|json|js|css)$/i.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  walk(outputDir);
  return results;
}

function containsSecretLikeFields(content: string): boolean {
  const lowered = content.toLocaleLowerCase("de");
  return (
    lowered.includes("passwordhash") ||
    lowered.includes("dm_only") ||
    lowered.includes("sessiontoken") ||
    lowered.includes("auth_secret")
  );
}

