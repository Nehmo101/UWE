import type { PageViewData, NavCategory } from "@uwe/database/server";
import {
  portalUrlToStaticHref,
  relativeHref,
  STATIC_EXPORT_CATEGORY_LABELS,
} from "./paths";

export interface StaticNavItem {
  title: string;
  href: string;
  category: string;
  navCategory: NavCategory;
}

export interface StaticPageTemplateInput {
  worldName: string;
  worldDescription: string | null;
  pageTitle: string;
  pageTags: string[];
  html: string;
  backlinks: { title: string; href: string }[];
  relatedPages: { title: string; href: string; reasons: string[] }[];
  navItems: StaticNavItem[];
  currentDir: string;
  worldSlug: string;
  isHome?: boolean;
}

function rewriteHref(href: string, currentDir: string, worldSlug: string): string {
  if (!href || href.startsWith("http") || href.startsWith("#")) {
    return href;
  }

  if (href === `/worlds/${worldSlug}` || href === `/worlds/${worldSlug}/`) {
    return relativeHref(currentDir, "./");
  }

  const staticHref = portalUrlToStaticHref(href, worldSlug);
  return relativeHref(currentDir, staticHref);
}

function renderNavGroups(
  navItems: StaticNavItem[],
  currentDir: string,
  worldSlug: string,
): string {
  const grouped = new Map<string, StaticNavItem[]>();

  for (const item of navItems) {
    const list = grouped.get(item.category) ?? [];
    list.push(item);
    grouped.set(item.category, list);
  }

  const sections: string[] = [];

  for (const [category, items] of grouped) {
    const label = STATIC_EXPORT_CATEGORY_LABELS[category] ?? category;
    sections.push(`
      <div class="static-nav-group">
        <h4>${escapeHtml(label)}</h4>
        <ul>
          ${items
            .map(
              (item) =>
                `<li><a href="${escapeAttr(
                  rewriteHref(item.href, currentDir, worldSlug),
                )}">${escapeHtml(item.title)}</a></li>`,
            )
            .join("")}
        </ul>
      </div>
    `);
  }

  return sections.join("");
}

function renderSidebarList(
  title: string,
  items: { title: string; href: string; meta?: string }[],
  currentDir: string,
  worldSlug: string,
  emptyText: string,
): string {
  if (items.length === 0) {
    return `
      <section class="wiki-sidebar-section">
        <h3>${escapeHtml(title)}</h3>
        <p class="wiki-empty">${escapeHtml(emptyText)}</p>
      </section>
    `;
  }

  return `
    <section class="wiki-sidebar-section">
      <h3>${escapeHtml(title)}</h3>
      <ul>
        ${items
          .map(
            (item) => `
          <li>
            <a href="${escapeAttr(rewriteHref(item.href, currentDir, worldSlug))}">${escapeHtml(item.title)}</a>
            ${item.meta ? `<span class="wiki-meta">${escapeHtml(item.meta)}</span>` : ""}
          </li>
        `,
          )
          .join("")}
      </ul>
    </section>
  `;
}

export function renderStaticPage(input: StaticPageTemplateInput): string {
  const cssHref = relativeHref(input.currentDir, "assets/portal.css");
  const searchJsHref = relativeHref(input.currentDir, "assets/search.js");
  const searchIndexHref = relativeHref(input.currentDir, "search-index.json");
  const homeHref = relativeHref(input.currentDir, "./");

  const breadcrumb = input.isHome
    ? `<nav class="uwe-breadcrumb"><span>${escapeHtml(input.worldName)}</span></nav>`
    : `<nav class="uwe-breadcrumb">
        <a href="${escapeAttr(homeHref)}">${escapeHtml(input.worldName)}</a>
        <span class="uwe-breadcrumb-sep">/</span>
        <span>${escapeHtml(input.pageTitle)}</span>
      </nav>`;

  const tags = input.pageTags
    .map((tag) => `<span class="uwe-tag">${escapeHtml(tag)}</span>`)
    .join("");

  const related = input.relatedPages.map((item) => ({
    title: item.title,
    href: item.href,
    meta: item.reasons.join(", "),
  }));

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(input.pageTitle)} — ${escapeHtml(input.worldName)}</title>
  <meta name="description" content="Statischer Wiki-Export von ${escapeHtml(input.worldName)}">
  <link rel="stylesheet" href="${escapeAttr(cssHref)}">
</head>
<body>
  <div class="uwe-shell">
    <div class="static-export-banner">Statischer UWE-Export — ${escapeHtml(input.worldName)}</div>
    <header class="uwe-topbar">
      <a class="uwe-brand" href="${escapeAttr(homeHref)}">
        <span class="uwe-brand-mark">◆</span>
        <span>
          <strong>UWE Portal</strong>
          <small>${escapeHtml(input.worldName)}</small>
        </span>
      </a>
      <form class="uwe-search" role="search" onsubmit="return false;">
        <input
          type="search"
          placeholder="Suchen…"
          data-static-search
          data-search-index="${escapeAttr(searchIndexHref)}"
          aria-label="Wiki durchsuchen"
        >
      </form>
    </header>
    <div class="uwe-shell-body">
      <aside class="uwe-sidebar">
        <section class="uwe-sidebar-section">
          <h3>Navigation</h3>
          <p><a href="${escapeAttr(homeHref)}" style="color:#94a3b8;font-size:0.875rem;">← ${escapeHtml(input.worldName)}</a></p>
          ${renderNavGroups(input.navItems, input.currentDir, input.worldSlug)}
        </section>
      </aside>
      <main class="uwe-main">
        ${breadcrumb}
        <header class="uwe-page-header">
          <div>
            <h1>${escapeHtml(input.pageTitle)}</h1>
            ${tags ? `<div class="uwe-page-meta">${tags}</div>` : ""}
          </div>
        </header>
        <article class="wiki-content">${input.html}</article>
        <div data-static-search-results class="static-search-results"></div>
      </main>
      <aside class="uwe-context">
        ${renderSidebarList(
          "Backlinks",
          input.backlinks.map((item) => ({ title: item.title, href: item.href })),
          input.currentDir,
          input.worldSlug,
          "Keine Backlinks",
        )}
        ${renderSidebarList(
          "Verwandte Seiten",
          related,
          input.currentDir,
          input.worldSlug,
          "Keine verwandten Seiten",
        )}
      </aside>
    </div>
  </div>
  <script src="${escapeAttr(searchJsHref)}" defer></script>
</body>
</html>`;
}

export function renderWorldIndexPage(input: {
  worldName: string;
  worldDescription: string | null;
  pages: { title: string; href: string; summary: string | null; category: string }[];
  navItems: StaticNavItem[];
  worldSlug: string;
  atlasHref?: string;
}): string {
  const cards = input.pages
    .map(
      (page) => `
      <article class="static-page-card">
        <h2><a href="${escapeAttr(page.href)}">${escapeHtml(page.title)}</a></h2>
        ${page.summary ? `<p>${escapeHtml(page.summary)}</p>` : ""}
      </article>
    `,
    )
    .join("");

  return renderStaticPage({
    worldName: input.worldName,
    worldDescription: input.worldDescription,
    pageTitle: input.worldName,
    pageTags: [],
    html: `
      <section class="uwe-portal-hero">
        <div class="uwe-portal-hero-glow"></div>
        <p class="uwe-portal-hero-kicker">Spieler-Wiki</p>
        <h1>${escapeHtml(input.worldName)}</h1>
        ${
          input.worldDescription
            ? `<p class="uwe-portal-hero-desc">${escapeHtml(input.worldDescription)}</p>`
            : ""
        }
        <p class="uwe-portal-hero-meta">${input.pages.length} veröffentlichte Seiten</p>
        ${
          input.atlasHref
            ? `<p class="uwe-portal-hero-meta"><a href="${escapeAttr(input.atlasHref)}" style="color:#38bdf8;text-decoration:none;">Atlas / Karte öffnen →</a></p>`
            : ""
        }
      </section>
      <div class="static-page-grid">${cards}</div>
    `,
    backlinks: [],
    relatedPages: [],
    navItems: input.navItems,
    currentDir: "",
    worldSlug: input.worldSlug,
    isHome: true,
  });
}

export function rewriteViewForStatic(
  view: PageViewData,
  currentDir: string,
  worldSlug: string,
): {
  html: string;
  backlinks: { title: string; href: string }[];
  relatedPages: { title: string; href: string; reasons: string[] }[];
} {
  let html = view.html;

  for (const link of view.links) {
    if (link.status !== "resolved" || !link.href) continue;
    const staticHref = portalUrlToStaticHref(link.href, worldSlug);
    const relative = relativeHref(currentDir, staticHref);
    html = html.replace(
      `href="${link.href}"`,
      `href="${relative}"`,
    );
  }

  return {
    html,
    backlinks: view.backlinks,
    relatedPages: view.relatedPages,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(text: string): string {
  return escapeHtml(text);
}
