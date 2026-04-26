const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const contentJson = JSON.parse(fs.readFileSync(path.join(__dirname, "content.json"), "utf-8"));
const DOCS_DIR = path.join(__dirname, "docs");
fs.mkdirSync(DOCS_DIR, { recursive: true });

function htmlToMarkdown(html) {
  const $ = cheerio.load(html, null, false);

  // Remove Google Sites nav buttons
  $(".axx72").remove();
  $('[jscontroller="VXdfxd"]').remove();
  $("a.FKF6mc").each((_, el) => {
    $(el).closest(".N0neUc, .tyJCtd, section").remove();
  });

  // Remove remaining nav-like button sections
  $(".U26fgb").remove();
  $(".QmpIrf.M9Bg4d").remove();

  // Remove sections that only contain navigation buttons
  $("section").each((_, sec) => {
    const $sec = $(sec);
    const hasContent = $sec.find("p, h1, h2, h3, h4, ul, ol, table, img, [data-embed-open-url]").length > 0;
    const hasButtons = $sec.find("a.FKF6mc, a.QmpIrf, .U26fgb, a[href*='/view/tinf-site']").length > 0;
    if (hasButtons && !hasContent) {
      $sec.remove();
    }
  });

  // Remove Drive iframes (keep the embed info)
  $("iframe").remove();
  $(".t5qrWd").remove();
  $(".TPTLxf").remove();

  // Remove "Copy heading link" buttons
  $(".CjVfdc").remove();

  const lines = [];
  let lastWasEmpty = false;
  let firstH1Text = null;

  function addLine(line) {
    if (line === "") {
      if (!lastWasEmpty) {
        lines.push("");
        lastWasEmpty = true;
      }
    } else {
      lines.push(line);
      lastWasEmpty = false;
    }
  }

  function getPlainText(el) {
    // Get plain text content, stripping all markdown formatting
    let result = "";
    $(el).contents().each((_, node) => {
      if (node.type === "text") {
        result += $(node).text();
      } else if (node.type === "tag") {
        const tag = node.tagName.toLowerCase();
        if (tag === "br") {
          result += "\n";
        } else {
          result += getPlainText(node);
        }
      }
    });
    return result;
  }

  function getTextContent(el) {
    let result = "";
    const contents = $(el).contents().toArray();

    for (let i = 0; i < contents.length; i++) {
      const node = contents[i];

      if (node.type === "text") {
        result += $(node).text();
      } else if (node.type === "tag") {
        const tag = node.tagName.toLowerCase();
        if (tag === "br") {
          result += "\n";
        } else if (tag === "a") {
          const href = $(node).attr("href") || "";
          const text = getPlainText(node).trim();
          if (text && href) {
            // Check if previous text ends with a letter (split word before link)
            // e.g., "П" + <a>ример работы</a> → merge into link text
            const prevChar = result.length > 0 ? result[result.length - 1] : "";
            const isWordContinuation = /[а-яА-Яa-zA-Z]/.test(prevChar) && /^[а-яА-Яa-zA-Z]/.test(text);
            if (isWordContinuation) {
              // Find the partial word at end of result and merge into link
              const match = result.match(/([а-яА-Яa-zA-Z]+)$/);
              if (match) {
                result = result.slice(0, -match[1].length);
                result += `[${match[1]}${text}](${href})`;
              } else {
                result += `[${text}](${href})`;
              }
            } else {
              result += `[${text}](${href})`;
            }
          } else if (text) {
            result += text;
          }
        } else if (tag === "img") {
          const src = $(node).attr("src") || "";
          const alt = $(node).attr("alt") || "";
          if (src && !src.includes("drive-32.png") && !src.includes("McKOwe")) {
            result += `![${alt}](${src})`;
          }
        } else {
          const style = $(node).attr("style") || "";
          const isBold = style.includes("font-weight: 700") || style.includes("font-weight:700");
          const isItalic = style.includes("font-style: italic") || style.includes("font-style:italic");
          const innerText = getTextContent(node);
          if (innerText.trim()) {
            if (isBold && isItalic) {
              result += `***${innerText.trim()}***`;
            } else if (isBold) {
              result += `**${innerText.trim()}**`;
            } else if (isItalic) {
              result += `*${innerText.trim()}*`;
            } else {
              result += innerText;
            }
          }
        }
      }
    }
    return result;
  }

  // Detect tab-separated paragraphs (table-like data)
  function detectTabTable(el) {
    const $el = $(el);
    const paragraphs = $el.find("p");
    if (paragraphs.length < 3) return null;

    const rows = [];
    let allHaveTabs = true;
    paragraphs.each((_, p) => {
      const text = $(p).text().trim();
      if (!text) return;
      if (!text.includes("\t")) {
        allHaveTabs = false;
        return false; // break
      }
      const cells = text.split(/\t+/).map(c => c.trim()).filter(Boolean);
      if (cells.length >= 2) {
        rows.push(cells);
      }
    });

    if (allHaveTabs && rows.length >= 3) {
      return rows;
    }
    return null;
  }

  function processNode(el, listDepth = 0) {
    const $el = $(el);
    const tag = el.tagName ? el.tagName.toLowerCase() : "";

    if (tag === "div" || tag === "section") {
      // Check for Drive embeds
      const driveEmbed = $el.find("[data-embed-open-url]").first();
      if (driveEmbed.length) {
        const url = driveEmbed.attr("data-embed-open-url");
        const docTitle = driveEmbed.find(".pB4Yfc").text().trim()
          || driveEmbed.attr("aria-label")?.replace(/^Drive,\s*/, "")
          || "Document";
        addLine("");
        addLine(`> [${docTitle}](${url})`);
        addLine("");
        return;
      }

      // Check for tab-separated table data within a content div
      if ($el.hasClass("tyJCtd") || $el.hasClass("baZpAe")) {
        const tableRows = detectTabTable(el);
        if (tableRows) {
          addLine("");
          // Normalize column count
          const maxCols = Math.max(...tableRows.map(r => r.length));
          const header = tableRows[0];
          while (header.length < maxCols) header.push("");
          addLine("| " + header.join(" | ") + " |");
          addLine("| " + header.map(() => "---").join(" | ") + " |");
          for (let i = 1; i < tableRows.length; i++) {
            const row = tableRows[i];
            while (row.length < maxCols) row.push("");
            addLine("| " + row.join(" | ") + " |");
          }
          addLine("");
          return;
        }
      }

      // Check for standalone images (not inside paragraphs)
      const directImg = $el.children("img, .t3iYD");
      if (directImg.length) {
        const img = directImg.find("img").add(directImg.filter("img")).first();
        if (img.length) {
          const src = img.attr("src") || "";
          const alt = img.attr("alt") || "";
          if (src && !src.includes("drive-32.png") && !src.includes("McKOwe")) {
            addLine("");
            addLine(`![${alt}](${src})`);
            addLine("");
          }
        }
      }

      // Recurse into children
      $el.children().each((_, child) => {
        const childTag = child.tagName ? child.tagName.toLowerCase() : "";
        if (childTag === "img" || $(child).hasClass("t3iYD")) return;
        processNode(child, listDepth);
      });
      return;
    }

    if (/^h[1-6]$/.test(tag)) {
      const level = parseInt(tag[1]);
      const text = $el.text().trim();
      if (text) {
        if (level === 1) {
          if (firstH1Text === null) {
            firstH1Text = text;
          } else if (text === firstH1Text) {
            return;
          }
        }
        addLine("");
        addLine("#".repeat(level) + " " + text);
        addLine("");
      }
      return;
    }

    if (tag === "p") {
      const rawText = getTextContent(el);
      if (!rawText.trim()) return;

      let cleaned = rawText.trim()
        .replace(/\n/g, " ")
        .replace(/\t+/g, " ")
        .replace(/\s{2,}/g, " ")
        .replace(/\*\*\s*\*\*/g, "") // remove empty bold
        .replace(/\*\s*\*/g, "") // remove empty italic
        .trim();

      // Fix spacing around markers
      cleaned = cleaned
        .replace(/\*\*\s+\*\*/g, " ")
        .replace(/\) (?=[а-яА-Яa-zA-Z])/g, ") ") // space after paren
        .trim();

      if (cleaned) {
        addLine(cleaned);
        addLine("");
      }
      return;
    }

    if (tag === "ul" || tag === "ol") {
      $el.children("li").each((i, li) => {
        const prefix = tag === "ol" ? `${i + 1}. ` : "- ";
        const indent = "  ".repeat(listDepth);

        const liClone = $(li).clone();
        liClone.find("ul, ol").remove();
        let text = getTextContent(liClone[0]).trim()
          .replace(/\n/g, " ")
          .replace(/\t+/g, " ")
          .replace(/\s{2,}/g, " ")
          .replace(/\*\*\s*\*\*/g, "")
          .replace(/\*\s*\*/g, "")
          .trim();

        if (text) {
          addLine(indent + prefix + text);
        }

        $(li).children("ul, ol").each((_, nestedList) => {
          processNode(nestedList, listDepth + 1);
        });
      });
      addLine("");
      return;
    }

    if (tag === "table") {
      const rows = [];
      $el.find("tr").each((_, tr) => {
        const cells = [];
        $(tr).find("td, th").each((_, cell) => {
          cells.push($(cell).text().trim().replace(/\n/g, " ").replace(/\s+/g, " "));
        });
        rows.push(cells);
      });

      if (rows.length > 0) {
        addLine("");
        addLine("| " + rows[0].join(" | ") + " |");
        addLine("| " + rows[0].map(() => "---").join(" | ") + " |");
        for (let i = 1; i < rows.length; i++) {
          addLine("| " + rows[i].join(" | ") + " |");
        }
        addLine("");
      }
      return;
    }

    if (tag === "a") {
      const href = $el.attr("href") || "";
      if ($el.hasClass("FKF6mc") || $el.hasClass("QmpIrf")) return;
      const text = $el.text().trim();
      if (text && href) {
        addLine(`[${text}](${href})`);
      }
      return;
    }

    if (tag === "img") {
      const src = $el.attr("src") || "";
      const alt = $el.attr("alt") || "";
      if (src && !src.includes("drive-32.png") && !src.includes("McKOwe")) {
        addLine(`![${alt}](${src})`);
      }
      return;
    }

    if (el.children) {
      $el.children().each((_, child) => processNode(child, listDepth));
    }
  }

  $.root().children().each((_, el) => processNode(el));

  let result = lines.join("\n");
  result = result.replace(/\n{3,}/g, "\n\n");
  result = result.split("\n").map(l => l.trimEnd()).join("\n");
  // Fix bold markers with trailing space before punctuation
  result = result.replace(/\*\* ([,.:;!?)])/g, "**$1");
  // Fix orphan markers
  result = result.replace(/\*\*\s*\*\*/g, "");
  result = result.replace(/\*\s*\*/g, "");
  // Fix stray italic around period: "*.*" → "."
  result = result.replace(/\*\.\*/g, ".");
  // Fix space before closing link bracket
  result = result.replace(/\]\s*\(/g, "](");
  // Fix double closing parens from links: )) → )
  result = result.replace(/\)\)/g, ")");
  // Fix missing space after closing link paren before a word
  result = result.replace(/\)([а-яА-Яa-zA-Z])/g, ") $1");
  // Fix missing space after period before capital letter
  result = result.replace(/\.([А-ЯA-Z])/g, ". $1");
  // Convert Google Sites internal links to hash-based page IDs
  result = result.replace(/\(\/view\/tinf-site\/([^)]+)\)/g, (_, p) => {
    const pageId = p.replace(/\//g, "_");
    return `(#${pageId})`;
  });
  result = result.trim() + "\n";

  return result;
}

for (const page of contentJson.pages) {
  const md = htmlToMarkdown(page.htmlContent);
  const outFile = path.join(DOCS_DIR, page.id + ".md");
  fs.writeFileSync(outFile, md, "utf-8");
  console.log(`${page.id}.md (${md.length} chars)`);
}

console.log("\nDone! Markdown files written to docs/");
