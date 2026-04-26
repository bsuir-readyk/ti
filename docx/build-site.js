const { marked } = require("marked");
const fs = require("fs");
const path = require("path");

const DOCS_DIR = path.join(__dirname, "docs");
const OUT_DIR = path.join(__dirname, "site");

fs.mkdirSync(OUT_DIR, { recursive: true });

// Read markdown files and build page structure
const files = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith(".md")).sort();

const pages = [];

for (const file of files) {
  const md = fs.readFileSync(path.join(DOCS_DIR, file), "utf-8");
  const id = file.replace(".md", "");
  const parts = id.split("_");
  const parentId = parts.length > 1 ? parts.slice(0, -1).join("_") : null;

  // Extract title from first h1
  const h1Match = md.match(/^#\s+(.+)$/m);
  const title = h1Match ? h1Match[1] : capitalize(parts[parts.length - 1].replace(/-/g, " "));

  const lastPart = parts[parts.length - 1];
  const displayName = capitalize(lastPart.replace(/-/g, " "));

  // Render markdown to HTML
  const htmlContent = marked(md);

  pages.push({ id, title, displayName, parentId, htmlContent });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Generate the static site as a single HTML file
const pagesJson = JSON.stringify(pages.map(p => ({
  id: p.id,
  title: p.title,
  displayName: p.displayName,
  parentId: p.parentId,
})));

const contentMap = {};
pages.forEach(p => { contentMap[p.id] = p.htmlContent; });

const indexHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Теория информации</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --sidebar-w: 280px;
    --bg: #fafafa;
    --sidebar-bg: #fff;
    --border: #e0e0e0;
    --text: #1a1a1a;
    --text-muted: #666;
    --accent: #1a73e8;
    --accent-bg: #e8f0fe;
    --hover-bg: #f5f5f5;
    --content-max: 900px;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
    display: flex;
    min-height: 100vh;
  }

  /* Sidebar */
  .sidebar {
    width: var(--sidebar-w);
    min-width: var(--sidebar-w);
    background: var(--sidebar-bg);
    border-right: 1px solid var(--border);
    overflow-y: auto;
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 10;
    transition: transform 0.25s ease;
  }

  .sidebar-header {
    padding: 20px 16px 12px;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
  }

  .sidebar-header:hover { background: var(--hover-bg); }

  .sidebar-header h2 {
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
  }

  .sidebar-header p {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .nav-tree { padding: 8px 0; }

  .nav-item {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    font: inherit;
    cursor: pointer;
    padding: 8px 16px;
    font-size: 14px;
    color: var(--text);
    transition: background 0.15s;
    border-left: 3px solid transparent;
  }

  .nav-item:hover { background: var(--hover-bg); }
  .nav-item.active {
    background: var(--accent-bg);
    color: var(--accent);
    border-left-color: var(--accent);
    font-weight: 500;
  }

  .nav-item.depth-1 { padding-left: 32px; font-size: 13px; }
  .nav-item.depth-2 { padding-left: 48px; font-size: 13px; color: var(--text-muted); }
  .nav-item.depth-3 { padding-left: 64px; font-size: 12px; color: var(--text-muted); }

  /* Main content */
  .main {
    margin-left: var(--sidebar-w);
    flex: 1;
    min-width: 0;
  }

  .topbar {
    position: sticky;
    top: 0;
    background: rgba(250, 250, 250, 0.95);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--border);
    padding: 10px 24px;
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 5;
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: var(--text-muted);
    flex-wrap: wrap;
  }

  .breadcrumb a {
    color: var(--accent);
    text-decoration: none;
    cursor: pointer;
  }

  .breadcrumb a:hover { text-decoration: underline; }
  .breadcrumb .sep { color: #ccc; margin: 0 2px; }

  .menu-btn {
    display: none;
    background: none;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 10px;
    cursor: pointer;
    font-size: 18px;
    margin-right: 8px;
  }

  .content {
    max-width: var(--content-max);
    margin: 0 auto;
    padding: 32px 24px 80px;
  }

  .content h1 {
    font-size: 28px;
    font-weight: 700;
    margin: 0 0 24px 0;
    line-height: 1.3;
  }

  .content h2 {
    font-size: 22px;
    font-weight: 600;
    margin: 28px 0 12px 0;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--border);
  }

  .content h3 {
    font-size: 18px;
    font-weight: 600;
    margin: 20px 0 8px 0;
  }

  .content h4, .content h5, .content h6 {
    font-size: 15px;
    font-weight: 600;
    margin: 16px 0 6px 0;
  }

  .content p {
    margin: 8px 0 12px;
    font-size: 15px;
    line-height: 1.7;
  }

  .content a {
    color: var(--accent);
    text-decoration: none;
  }

  .content a:hover { text-decoration: underline; }

  .content img {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 12px 0;
    box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  }

  .content table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 14px;
  }

  .content th, .content td {
    border: 1px solid var(--border);
    padding: 8px 12px;
    text-align: left;
  }

  .content th {
    background: #f0f0f0;
    font-weight: 600;
  }

  .content tr:nth-child(even) td { background: #fafafa; }
  .content tr:hover td { background: var(--accent-bg); }

  .content ul, .content ol {
    margin: 8px 0 16px;
    padding-left: 24px;
  }

  .content li {
    margin: 4px 0;
    font-size: 15px;
    line-height: 1.6;
  }

  .content blockquote {
    margin: 16px 0;
    padding: 0;
    border: none;
  }

  .content blockquote a {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text) !important;
    font-size: 15px;
    font-weight: 500;
    transition: all 0.15s;
    text-decoration: none !important;
  }

  .content blockquote a::before {
    content: "\\1F4C4";
    font-size: 20px;
  }

  .content blockquote a:hover {
    border-color: var(--accent);
    box-shadow: 0 2px 8px rgba(26,115,232,0.15);
    color: var(--accent) !important;
  }

  .content blockquote p {
    margin: 0;
  }

  .content code {
    background: #f0f0f0;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 13px;
  }

  .content pre {
    background: #f0f0f0;
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 16px 0;
  }

  .content pre code {
    background: none;
    padding: 0;
  }

  /* Sub-page navigation cards */
  .subpages {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
    margin-top: 24px;
  }

  .subpage-card {
    display: block;
    padding: 16px;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
    color: var(--text);
  }

  .subpage-card:hover {
    border-color: var(--accent);
    box-shadow: 0 2px 8px rgba(26,115,232,0.15);
    transform: translateY(-1px);
  }

  .subpage-card .card-title {
    font-weight: 500;
    font-size: 14px;
  }

  /* Prev/Next navigation */
  .page-nav {
    display: flex;
    justify-content: space-between;
    margin-top: 48px;
    padding-top: 24px;
    border-top: 1px solid var(--border);
    gap: 16px;
  }

  .page-nav-btn {
    display: flex;
    flex-direction: column;
    padding: 12px 16px;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
    color: var(--text);
    max-width: 48%;
  }

  .page-nav-btn:hover {
    border-color: var(--accent);
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }

  .page-nav-btn .label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  .page-nav-btn .title {
    font-size: 14px;
    font-weight: 500;
    color: var(--accent);
  }

  .page-nav-btn.next { margin-left: auto; text-align: right; }

  /* Mobile */
  @media (max-width: 768px) {
    .sidebar { transform: translateX(-100%); }
    .sidebar.open {
      transform: translateX(0);
      box-shadow: 4px 0 20px rgba(0,0,0,0.15);
    }
    .main { margin-left: 0; }
    .menu-btn { display: block; }
    .content { padding: 20px 16px 60px; }
    .overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.3);
      z-index: 9;
    }
    .overlay.show { display: block; }
  }
</style>
</head>
<body>

<div class="overlay" id="overlay" onclick="toggleSidebar()"></div>

<nav class="sidebar" id="sidebar">
  <div class="sidebar-header" onclick="navigate(defaultPage)">
    <h2>Теория информации</h2>
    <p>Практические задания</p>
  </div>
  <div class="nav-tree" id="navTree"></div>
</nav>

<div class="main">
  <div class="topbar">
    <button class="menu-btn" id="menuBtn" onclick="toggleSidebar()">&#9776;</button>
    <div class="breadcrumb" id="breadcrumb"></div>
  </div>
  <div class="content" id="content"></div>
</div>

<script>
const PAGES = ${pagesJson};
const CONTENT = ${JSON.stringify(contentMap)};

const pageMap = {};
PAGES.forEach(p => { pageMap[p.id] = p; });

// Build children map
const childrenMap = {};
PAGES.forEach(p => {
  if (!childrenMap[p.id]) childrenMap[p.id] = [];
  if (p.parentId && pageMap[p.parentId]) {
    if (!childrenMap[p.parentId]) childrenMap[p.parentId] = [];
    childrenMap[p.parentId].push(p);
  }
});

// Flat ordered list for prev/next
const flatOrder = PAGES.map(p => p.id);

function getDepth(page) {
  let d = 0, p = page;
  while (p.parentId && pageMap[p.parentId]) { d++; p = pageMap[p.parentId]; }
  return d;
}

function getBreadcrumbs(pageId) {
  const crumbs = [];
  let p = pageMap[pageId];
  while (p) {
    crumbs.unshift(p);
    p = p.parentId ? pageMap[p.parentId] : null;
  }
  return crumbs;
}

// Render sidebar
function renderNav() {
  const nav = document.getElementById("navTree");
  let html = "";
  PAGES.forEach(p => {
    const depth = getDepth(p);
    html += '<button class="nav-item depth-' + depth + '" data-id="' + p.id + '" onclick="navigate(\\'' + p.id + '\\')">' + p.displayName + '</button>';
  });
  nav.innerHTML = html;
}

// Render page
let currentPage = null;
function navigate(pageId, skipHash) {
  const page = pageMap[pageId];
  if (!page) return;
  if (pageId === currentPage) return;
  currentPage = pageId;

  // Update hash (skip when called from hashchange to avoid re-trigger)
  if (!skipHash) location.hash = pageId;

  // Update active nav
  document.querySelectorAll(".nav-item").forEach(el => {
    el.classList.toggle("active", el.dataset.id === pageId);
  });

  // Scroll nav item into view
  const activeNav = document.querySelector('.nav-item.active');
  if (activeNav) activeNav.scrollIntoView({ block: "nearest" });

  // Breadcrumbs
  const crumbs = getBreadcrumbs(pageId);
  const bc = document.getElementById("breadcrumb");
  bc.innerHTML = crumbs.map((c, i) => {
    if (i === crumbs.length - 1) return '<span>' + c.displayName + '</span>';
    return '<a onclick="navigate(\\'' + c.id + '\\')">' + c.displayName + '</a><span class="sep">/</span>';
  }).join("");

  // Content
  let html = CONTENT[pageId] || "<p>No content</p>";

  // Add sub-page cards
  const children = childrenMap[pageId] || [];
  if (children.length > 0) {
    html += '<div class="subpages">';
    children.forEach(c => {
      html += '<div class="subpage-card" onclick="navigate(\\'' + c.id + '\\')">' +
        '<div class="card-title">' + c.displayName + '</div></div>';
    });
    html += '</div>';
  }

  // Prev/Next
  const idx = flatOrder.indexOf(pageId);
  html += '<div class="page-nav">';
  if (idx > 0) {
    const prev = pageMap[flatOrder[idx - 1]];
    html += '<div class="page-nav-btn prev" onclick="navigate(\\'' + prev.id + '\\')">' +
      '<span class="label">&larr; Назад</span><span class="title">' + prev.displayName + '</span></div>';
  }
  if (idx < flatOrder.length - 1) {
    const next = pageMap[flatOrder[idx + 1]];
    html += '<div class="page-nav-btn next" onclick="navigate(\\'' + next.id + '\\')">' +
      '<span class="label">Далее &rarr;</span><span class="title">' + next.displayName + '</span></div>';
  }
  html += '</div>';

  document.getElementById("content").innerHTML = html;
  window.scrollTo(0, 0);

  // Close sidebar on mobile
  if (window.innerWidth <= 768) {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("overlay").classList.remove("show");
  }
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("overlay").classList.toggle("show");
}

// Init
renderNav();
const defaultPage = 'практические-задания';
const initialPage = location.hash ? decodeURIComponent(location.hash.slice(1)) : defaultPage;
navigate(initialPage, true);

window.addEventListener("hashchange", () => {
  const pageId = location.hash ? decodeURIComponent(location.hash.slice(1)) : defaultPage;
  navigate(pageId, true);
});

// Intercept clicks on internal hash links in content
document.getElementById("content").addEventListener("click", (e) => {
  const a = e.target.closest("a[href^='#']");
  if (a) {
    const pageId = a.getAttribute("href").slice(1);
    if (pageMap[pageId]) {
      e.preventDefault();
      navigate(pageId);
    }
  }
});

// Keyboard: left/right arrows for prev/next
document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  const idx = flatOrder.indexOf(decodeURIComponent(location.hash.slice(1)));
  if (e.key === "ArrowLeft" && idx > 0) { e.preventDefault(); navigate(flatOrder[idx - 1]); }
  if (e.key === "ArrowRight" && idx < flatOrder.length - 1) { e.preventDefault(); navigate(flatOrder[idx + 1]); }
});
</script>

</body>
</html>`;

fs.writeFileSync(path.join(OUT_DIR, "index.html"), indexHtml, "utf-8");
console.log("Built site/index.html with " + pages.length + " pages");
console.log("Pages:");
pages.forEach(p => console.log("  " + p.id + ' -> "' + p.displayName + '" (' + p.htmlContent.length + " chars)"));
