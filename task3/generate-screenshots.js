const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const ROOT = __dirname;
const EXAMPLES_DIR = path.resolve(ROOT, "../task2/examples");
const SCREENSHOTS_DIR = path.join(ROOT, "screenshots");
const REPORT_SCREENSHOTS_DIR = path.join(ROOT, "report_screenshots");
const GENERATED_DIR = path.join(ROOT, "generated");
const GENERATED_FILES_DIR = path.join(GENERATED_DIR, "files");
const HEX_VIEWER_PATH = path.resolve(ROOT, "../hex-viewer/index.html");

const PARAMS = {
  p: 257n,
  x: 37n,
  k: 71n,
  g: 3n,
};

const BLOCK_SIZE = 4;

const scenarios = [
  {
    key: "text",
    title: "Текстовый файл",
    sourceName: "sample.txt",
    reportImages: [7, 8, 16, 11, 12, 13, 14, 10, 23, 19],
    organizedPrefix: "01_text",
  },
  {
    key: "video",
    title: "Видеофайл",
    sourceName: "7102266-hd_1920_1080_30fps.mp4",
    reportImages: [42, 25, 26, 31, 20, 34, 29, 36, 41],
    organizedPrefix: "02_video",
  },
  {
    key: "audio",
    title: "Аудиофайл",
    sourceName: "file_example_MP3_700KB.mp3",
    reportImages: [39, 2, 3, 6, 9, 4, 5, 1, 40],
    organizedPrefix: "03_audio",
  },
  {
    key: "image",
    title: "Картинка",
    sourceName: "Screenshot 2026-03-15 at 19.49.06.png",
    reportImages: [37, 17, 18, 24, 21, 28, 30, 22, 38],
    organizedPrefix: "04_image",
  },
];

const wrongKeyImages = [33, 35, 32, 27, 15];

function mod(a, m) {
  return ((a % m) + m) % m;
}

function modPow(base, exp, m) {
  let result = 1n;
  let b = mod(base, m);
  let e = exp;

  while (e > 0n) {
    if (e % 2n === 1n) result = mod(result * b, m);
    b = mod(b * b, m);
    e /= 2n;
  }

  return result;
}

function encryptBytes(bytes, params) {
  const { p, x, k, g } = params;
  const y = modPow(g, x, p);
  const a = modPow(g, k, p);
  const yk = modPow(y, k, p);
  const encrypted = Buffer.alloc(bytes.length * BLOCK_SIZE);

  for (let i = 0; i < bytes.length; i += 1) {
    const b = mod(BigInt(bytes[i]) * yk, p);
    encrypted.writeUInt16BE(Number(a), i * BLOCK_SIZE);
    encrypted.writeUInt16BE(Number(b), i * BLOCK_SIZE + 2);
  }

  return encrypted;
}

function decryptBytes(bytes, params) {
  const { p, x } = params;
  if (bytes.length % BLOCK_SIZE !== 0) {
    throw new Error("Encrypted data length must be divisible by 4.");
  }

  const decrypted = Buffer.alloc(bytes.length / BLOCK_SIZE);

  for (let i = 0; i < decrypted.length; i += 1) {
    const a = BigInt(bytes.readUInt16BE(i * BLOCK_SIZE));
    const b = BigInt(bytes.readUInt16BE(i * BLOCK_SIZE + 2));
    const m = mod(b * modPow(a, p - 1n - x, p), p);
    decrypted[i] = Number(m);
  }

  return decrypted;
}

function ensureDirectories() {
  fs.mkdirSync(REPORT_SCREENSHOTS_DIR, { recursive: true });
  fs.mkdirSync(GENERATED_FILES_DIR, { recursive: true });
  for (const scenario of scenarios) {
    fs.mkdirSync(path.join(SCREENSHOTS_DIR, scenario.key), { recursive: true });
  }
  fs.mkdirSync(path.join(SCREENSHOTS_DIR, "wrongkey"), { recursive: true });
}

function prepareScenarioFiles() {
  for (const scenario of scenarios) {
    const sourcePath = path.join(EXAMPLES_DIR, scenario.sourceName);
    const encryptedPath = path.join(GENERATED_FILES_DIR, `${scenario.sourceName}.eg`);
    const decryptedPath = path.join(GENERATED_FILES_DIR, `decrypted_${scenario.sourceName}`);

    const source = fs.readFileSync(sourcePath);
    const encrypted = encryptBytes(source, PARAMS);
    const decrypted = decryptBytes(encrypted, PARAMS);
    const wrongDecrypted = decryptBytes(encrypted, { ...PARAMS, x: 38n });

    fs.writeFileSync(encryptedPath, encrypted);
    fs.writeFileSync(decryptedPath, decrypted);
    const wrongDecryptedPath = path.join(GENERATED_FILES_DIR, `wrongkey_${scenario.sourceName}`);
    fs.writeFileSync(wrongDecryptedPath, wrongDecrypted);

    Object.assign(scenario, {
      sourcePath,
      encryptedPath,
      decryptedPath,
      wrongDecryptedPath,
      sourceBytes: source.length,
      encryptedBytes: encrypted.length,
    });
  }
}

async function waitForIdleUi(page) {
  await page.waitForFunction(() => {
    const overlay = document.getElementById("loading-overlay");
    return overlay && !overlay.classList.contains("is-visible");
  });
}

async function resetPage(page) {
  await page.goto(`file://${path.join(ROOT, "index.html")}`, {
    waitUntil: "domcontentloaded",
  });
  await page.setViewport({ width: 960, height: 900, deviceScaleFactor: 1 });
  await page.evaluate((params) => {
    document.getElementById("p-val").value = params.p;
    document.getElementById("x-val").value = params.x;
    document.getElementById("k-val").value = params.k;
    document.getElementById("g-val").value = params.g;
    document.getElementById("roots-output").value = "";
    document.getElementById("encrypted-output").value = "";
    document.getElementById("blocks-output").value = "";
    document.getElementById("param-error").textContent = "";
    for (const id of ["p-val", "x-val", "k-val", "g-val"]) {
      document.getElementById(id).dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, {
    p: String(PARAMS.p),
    x: String(PARAMS.x),
    k: String(PARAMS.k),
    g: String(PARAMS.g),
  });
}

async function findRoots(page) {
  await page.click("#find-roots-btn");
  await waitForIdleUi(page);
  await page.waitForFunction(() => document.getElementById("roots-output").value.includes("Найдено корней"));
}

async function encryptInUi(page, sourcePath) {
  const input = await page.$("#file-encrypt");
  await input.uploadFile(sourcePath);
  await page.click("#encrypt-btn");
  await waitForIdleUi(page);
  await page.waitForFunction(() => document.getElementById("encrypted-output").value.length > 0);
}

async function decryptInUi(page, encryptedPath, xValue = String(PARAMS.x)) {
  await page.evaluate((x) => {
    document.getElementById("x-val").value = x;
    document.getElementById("x-val").dispatchEvent(new Event("input", { bubbles: true }));
  }, xValue);
  const input = await page.$("#file-decrypt");
  await input.uploadFile(encryptedPath);
  await page.click("#decrypt-btn");
  await waitForIdleUi(page);
}

async function screenshotElement(page, selector, outputPath) {
  const element = await page.$(selector);
  if (!element) throw new Error(`Missing selector: ${selector}`);
  await element.screenshot({ path: outputPath });
}

async function screenshotHexViewer(page, filePath, outputPath) {
  await page.setViewport({ width: 960, height: 720, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([
    { name: "prefers-color-scheme", value: "light" },
  ]);
  await page.goto(`file://${HEX_VIEWER_PATH}`, { waitUntil: "domcontentloaded" });

  const input = await page.$("#fileInput");
  await input.uploadFile(filePath);
  await page.evaluate(() => {
    document.getElementById("fileInput").dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(
    (name) => document.getElementById("fileMeta").textContent.includes(name),
    {},
    path.basename(filePath),
  );
  await screenshotElement(page, "#app", outputPath);
}

async function copyShot(source, destinations) {
  for (const destination of destinations) {
    if (destination !== source) {
      fs.copyFileSync(source, destination);
    }
  }
}

async function captureScenario(page, scenario) {
  await resetPage(page);
  await findRoots(page);

  const organizedDir = path.join(SCREENSHOTS_DIR, scenario.key);
  const shots = {};
  const saveElement = async (key, name, selector) => {
    const outputPath = path.join(organizedDir, `${scenario.organizedPrefix}_${name}`);
    await screenshotElement(page, selector, outputPath);
    shots[key] = outputPath;
  };
  const saveHex = async (key, name, filePath) => {
    const outputPath = path.join(organizedDir, `${scenario.organizedPrefix}_${name}`);
    await screenshotHexViewer(page, filePath, outputPath);
    shots[key] = outputPath;
  };

  await saveElement("params", "01_params.png", ".section:nth-of-type(1)");
  await saveElement("roots", "02_roots.png", ".section:nth-of-type(2)");

  const encryptInput = await page.$("#file-encrypt");
  await encryptInput.uploadFile(scenario.sourcePath);
  await saveElement("encryptSelected", "03_encrypt_selected.png", ".section:nth-of-type(3)");

  await encryptInUi(page, scenario.sourcePath);
  await saveElement("encryptedBytes", "04_encrypted_bytes.png", ".section:nth-of-type(5)");
  await saveElement("encryptedBlocks", "05_encrypted_blocks.png", ".section:nth-of-type(6)");
  await saveElement("fullEncrypted", "06_full_encrypted.png", ".container");

  const decryptInput = await page.$("#file-decrypt");
  await decryptInput.uploadFile(scenario.encryptedPath);
  await saveElement("decryptSelected", "07_decrypt_selected.png", ".section:nth-of-type(4)");

  await decryptInUi(page, scenario.encryptedPath);
  await saveElement("decryptedBytes", "08_decrypted_bytes.png", ".section:nth-of-type(5)");
  await saveElement("fullDecrypted", "09_full_decrypted.png", ".container");
  await saveElement("keyInfo", "10_key_info.png", "#key-info");

  await saveHex("originalHex", "11_original_hex.png", scenario.sourcePath);
  await saveHex("encryptedHex", "12_encrypted_hex.png", scenario.encryptedPath);
  await saveHex("decryptedHex", "13_decrypted_hex.png", scenario.decryptedPath);

  const reportLabels = scenario.key === "text"
    ? [
        "params",
        "roots",
        "encryptSelected",
        "encryptedBytes",
        "encryptedBlocks",
        "encryptedHex",
        "originalHex",
        "decryptSelected",
        "decryptedHex",
        "fullDecrypted",
      ]
    : [
        "params",
        "roots",
        "encryptSelected",
        "encryptedBytes",
        "encryptedBlocks",
        "encryptedHex",
        "originalHex",
        "decryptSelected",
        "decryptedHex",
      ];

  for (let index = 0; index < scenario.reportImages.length; index += 1) {
    const shotPath = shots[reportLabels[index]];
    const reportPath = path.join(REPORT_SCREENSHOTS_DIR, path.basename(shotPath));
    await copyShot(shotPath, [reportPath]);
  }
}

async function captureWrongKey(page) {
  const scenario = scenarios[0];
  await resetPage(page);
  await findRoots(page);

  const organizedDir = path.join(SCREENSHOTS_DIR, "wrongkey");
  const shots = {};
  const saveElement = async (key, name, selector) => {
    const outputPath = path.join(organizedDir, `05_wrongkey_${name}`);
    await screenshotElement(page, selector, outputPath);
    shots[key] = outputPath;
  };
  const saveHex = async (key, name, filePath) => {
    const outputPath = path.join(organizedDir, `05_wrongkey_${name}`);
    await screenshotHexViewer(page, filePath, outputPath);
    shots[key] = outputPath;
  };

  await page.evaluate(() => {
    document.getElementById("x-val").value = "38";
    document.getElementById("x-val").dispatchEvent(new Event("input", { bubbles: true }));
  });
  await saveElement("wrongParams", "01_wrong_params.png", ".section:nth-of-type(1)");

  const input = await page.$("#file-decrypt");
  await input.uploadFile(scenario.encryptedPath);
  await saveElement("wrongDecryptSelected", "02_wrong_decrypt_selected.png", ".section:nth-of-type(4)");

  await decryptInUi(page, scenario.encryptedPath, "38");
  await page.waitForFunction(() => (
    document.getElementById("encrypted-output").value.length > 0 ||
    document.getElementById("param-error").textContent.length > 0
  ));
  await saveElement("wrongResult", "03_wrong_result.png", ".section:nth-of-type(5)");
  await saveElement("wrongFull", "04_wrong_full.png", ".container");

  await saveHex("encryptedHex", "05_encrypted_hex.png", scenario.encryptedPath);
  await saveHex("wrongHex", "06_wrong_decrypted_hex.png", scenario.wrongDecryptedPath);

  const reportLabels = [
    "wrongParams",
    "encryptedHex",
    "wrongHex",
    "wrongDecryptSelected",
    "wrongFull",
  ];

  for (let index = 0; index < wrongKeyImages.length; index += 1) {
    const shotPath = shots[reportLabels[index]];
    const reportPath = path.join(REPORT_SCREENSHOTS_DIR, path.basename(shotPath));
    await copyShot(shotPath, [reportPath]);
  }
}

async function main() {
  ensureDirectories();
  prepareScenarioFiles();

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--allow-file-access-from-files"],
  });

  try {
    const page = await browser.newPage();
    page.on("dialog", (dialog) => dialog.dismiss());

    for (const scenario of scenarios) {
      console.log(`Capturing ${scenario.title}: ${scenario.sourceName}`);
      await captureScenario(page, scenario);
    }

    console.log("Capturing wrong-key case");
    await captureWrongKey(page);
  } finally {
    await browser.close();
  }

  const metadata = {
    params: {
      p: String(PARAMS.p),
      x: String(PARAMS.x),
      k: String(PARAMS.k),
      g: String(PARAMS.g),
      y: String(modPow(PARAMS.g, PARAMS.x, PARAMS.p)),
    },
    scenarios: scenarios.map((scenario) => ({
      key: scenario.key,
      sourceName: scenario.sourceName,
      sourceBytes: scenario.sourceBytes,
      encryptedBytes: scenario.encryptedBytes,
      encryptedFile: path.relative(ROOT, scenario.encryptedPath),
      decryptedFile: path.relative(ROOT, scenario.decryptedPath),
      wrongDecryptedFile: path.relative(ROOT, scenario.wrongDecryptedPath),
    })),
  };

  fs.writeFileSync(
    path.join(GENERATED_DIR, "screenshot-metadata.json"),
    JSON.stringify(metadata, null, 2),
  );

  console.log(`Done. Report screenshots saved to ${path.relative(ROOT, REPORT_SCREENSHOTS_DIR)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
