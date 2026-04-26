const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const BASE_URL = "https://sites.google.com/view/tinf-site";
const OUTPUT_DIR = path.join(__dirname, "scraped-pages");

async function scrape() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Start from main page
  const startUrl = `${BASE_URL}/%D0%B3%D0%BB%D0%B0%D0%B2%D0%BD%D0%B0%D1%8F-%D1%81%D1%82%D1%80%D0%B0%D0%BD%D0%B8%D1%86%D0%B0`;

  console.log("Loading start page to discover all links...");
  await page.goto(startUrl, { waitUntil: "networkidle2", timeout: 30000 });

  // Collect all internal links from navigation
  const links = await page.evaluate((base) => {
    const anchors = document.querySelectorAll("a[href]");
    const urls = new Set();
    for (const a of anchors) {
      const href = a.href;
      if (href.startsWith(base)) {
        urls.add(href.split("?")[0].split("#")[0]); // strip query/hash
      }
    }
    return [...urls];
  }, BASE_URL);

  // Make sure start page is included
  const allUrls = [...new Set([startUrl, ...links])];
  console.log(`Found ${allUrls.length} pages to scrape:\n`);
  allUrls.forEach((u) => console.log("  ", u));
  console.log();

  for (const url of allUrls) {
    console.log(`Scraping: ${url}`);
    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

      // Wait for main content to render (Google Sites is SPA)
      await page.waitForSelector('[role="main"], .sites-content', {
        timeout: 10000,
      }).catch(() => {});

      // Extract page title
      const title = await page.title();

      // Get the full page HTML
      const html = await page.content();

      // Build filename from URL path — decode Cyrillic to keep names short
      const urlPath = decodeURIComponent(
        new URL(url).pathname
          .replace(/^\/view\/tinf-site\/?/, "")
          .replace(/\//g, "_")
      );
      const filename = (urlPath || "index") + ".html";

      const filePath = path.join(OUTPUT_DIR, filename);
      fs.writeFileSync(filePath, html, "utf-8");
      console.log(`  -> saved: ${filename} (${title})`);
    } catch (err) {
      console.error(`  !! Error scraping ${url}: ${err.message}`);
    }
  }

  await browser.close();
  console.log(`\nDone! Pages saved to: ${OUTPUT_DIR}`);
}

scrape().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
