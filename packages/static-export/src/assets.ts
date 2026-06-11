import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

export function bundlePortalStyles(): string {
  const uweCss = fs.readFileSync(
    path.resolve(packageRoot, "../../shared-ui/src/uwe.css"),
    "utf8",
  );
  const wikiCss = fs.readFileSync(
    path.resolve(packageRoot, "../../../apps/portal/app/wiki.css"),
    "utf8",
  );

  const staticExtras = `
.static-export-banner {
  padding: 0.55rem 1rem;
  background: rgba(56, 189, 248, 0.1);
  border-bottom: 1px solid rgba(56, 189, 248, 0.2);
  color: #7dd3fc;
  font-size: 0.82rem;
  text-align: center;
}

.static-search-results {
  display: grid;
  gap: 0.85rem;
  margin-top: 1rem;
}

.static-search-hit {
  padding: 1rem 1.1rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(15, 23, 42, 0.55);
}

.static-search-hit h3 {
  margin: 0 0 0.35rem;
  font-size: 1.05rem;
}

.static-search-hit h3 a {
  color: #38bdf8;
  text-decoration: none;
}

.static-search-hit p {
  margin: 0;
  color: #94a3b8;
  font-size: 0.875rem;
}

.static-search-meta {
  margin-top: 0.35rem;
  font-size: 0.75rem;
  color: #64748b;
}

.static-page-grid {
  display: grid;
  gap: 1rem;
  margin-top: 1.25rem;
}

.static-page-card {
  padding: 1.1rem 1.2rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(15, 23, 42, 0.55);
}

.static-page-card h2 {
  margin: 0 0 0.35rem;
  font-size: 1.15rem;
}

.static-page-card h2 a {
  color: #38bdf8;
  text-decoration: none;
}

.static-page-card p {
  margin: 0;
  color: #94a3b8;
  font-size: 0.875rem;
}

.static-nav-group {
  margin-top: 1rem;
}

.static-nav-group h4 {
  margin: 0 0 0.35rem;
  font-size: 0.78rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #64748b;
}

.static-nav-group ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.static-nav-group li {
  margin-bottom: 0.25rem;
}

.static-nav-group a {
  color: #cbd5e1;
  text-decoration: none;
  font-size: 0.875rem;
}

.static-nav-group a:hover {
  color: #38bdf8;
}
`;

  return `${uweCss}\n${wikiCss}\n${staticExtras}`;
}

export function bundleSearchScript(): string {
  return `(() => {
  const input = document.querySelector("[data-static-search]");
  const results = document.querySelector("[data-static-search-results]");
  if (!input || !results) return;

  let index = [];

  const indexUrl = input.getAttribute("data-search-index") || "search-index.json";

  fetch(indexUrl)
    .then((response) => response.json())
    .then((data) => {
      index = Array.isArray(data) ? data : [];
    })
    .catch(() => {
      index = [];
    });

  function render(items) {
    if (!items.length) {
      results.innerHTML = '<p class="wiki-empty">Keine Treffer.</p>';
      return;
    }

    results.innerHTML = items
      .map(
        (item) =>
          '<article class="static-search-hit">' +
          '<h3><a href="' +
          item.href +
          '">' +
          escapeHtml(item.title) +
          "</a></h3>" +
          (item.summary
            ? "<p>" + escapeHtml(item.summary) + "</p>"
            : "") +
          '<div class="static-search-meta">' +
          escapeHtml(item.category) +
          (item.tags?.length ? " · " + escapeHtml(item.tags.join(", ")) : "") +
          "</div>" +
          "</article>",
      )
      .join("");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function search(query) {
    const q = query.trim().toLocaleLowerCase("de");
    if (!q) {
      results.innerHTML = "";
      return;
    }

    const hits = index.filter((item) => {
      const haystack = [
        item.title,
        item.summary,
        item.slug,
        ...(item.tags || []),
        ...(item.aliases || []),
      ]
        .join(" ")
        .toLocaleLowerCase("de");
      return haystack.includes(q);
    });

    render(hits.slice(0, 25));
  }

  input.addEventListener("input", (event) => {
    search(event.target.value);
  });

  const params = new URLSearchParams(window.location.search);
  const initial = params.get("q");
  if (initial) {
    input.value = initial;
    search(initial);
  }
})();
`;
}

export function collectUploadReferences(content: string): string[] {
  const refs = new Set<string>();
  const patterns = [
    /\/uploads\/[^\s"'<>]+/g,
    /assets\/[^\s"'<>]+\.(?:png|jpe?g|gif|webp|svg|pdf|mp3|wav|ogg)/gi,
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      refs.add(match[0].replace(/^\/+/, ""));
    }
  }

  return [...refs];
}

export function copyReferencedAssets(
  references: string[],
  uploadsDir: string,
  outputAssetsDir: string,
): string[] {
  const copied: string[] = [];

  for (const ref of references) {
    const sourcePath = path.join(uploadsDir, ref.replace(/^uploads\//, ""));
    if (!fs.existsSync(sourcePath)) {
      continue;
    }

    const targetPath = path.join(outputAssetsDir, path.basename(ref));
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
    copied.push(`assets/${path.basename(ref)}`);
  }

  return copied;
}

export function writeBundledAssets(outputDir: string): void {
  const assetsDir = path.join(outputDir, "assets");
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.writeFileSync(path.join(assetsDir, "portal.css"), bundlePortalStyles(), "utf8");
  fs.writeFileSync(path.join(assetsDir, "search.js"), bundleSearchScript(), "utf8");
}
