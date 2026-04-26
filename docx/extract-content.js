const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const SCRAPED_DIR = path.join(__dirname, "scraped-pages");
const OUTPUT_FILE = path.join(__dirname, "content.json");

const files = fs
  .readdirSync(SCRAPED_DIR)
  .filter((f) => f.endsWith(".html"))
  .sort();

function deriveId(filename) {
  return filename.replace(/\.html$/, "");
}

function deriveParentId(id) {
  const lastUnderscore = id.lastIndexOf("_");
  if (lastUnderscore === -1) return null;
  return id.substring(0, lastUnderscore);
}

const pages = [];

for (const filename of files) {
  const filepath = path.join(SCRAPED_DIR, filename);
  const html = fs.readFileSync(filepath, "utf-8");
  const $ = cheerio.load(html);

  // Extract title from <title> tag
  const title = $("title").text().trim();

  // Extract the main content area
  const mainEl = $('[role="main"]');

  let htmlContent = "";
  if (mainEl.length > 0) {
    // In Google Sites, sections with class "yaqOZd" contain the content blocks
    const sections = $("section.yaqOZd");

    const contentParts = [];

    // First, get the h1 from role="main"
    const h1 = mainEl.find("h1").first();
    if (h1.length) {
      contentParts.push($.html(h1));
    }

    // Then get content from each section
    sections.each((i, section) => {
      contentParts.push($.html(section));
    });

    htmlContent = contentParts.join("\n");
  }

  const id = deriveId(filename);
  const parentId = deriveParentId(id);

  pages.push({
    id,
    filename,
    title,
    htmlContent,
    parentId,
  });

  // Log summary
  const allText = cheerio
    .load(htmlContent)("body")
    .text()
    .trim()
    .replace(/\s+/g, " ");
  const preview = allText.substring(0, 200);
  console.log(`\n=== ${filename} ===`);
  console.log(`Title: ${title}`);
  console.log(`ID: ${id}`);
  console.log(`Parent: ${parentId || "(root)"}`);
  console.log(`Content length: ${htmlContent.length} chars`);
  console.log(`Text preview: ${preview}...`);
}

const result = { pages };
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf-8");
console.log(`\n\nWrote ${pages.length} pages to ${OUTPUT_FILE}`);
