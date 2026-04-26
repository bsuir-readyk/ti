const BLOCK_SIZE = 4;
const UINT16_MAX = 65535n;
const DISPLAY_LIMIT = 6000;

let cachedRoots = [];
let cachedRootMod = null;

const mod = (a, m) => ((a % m) + m) % m;

const gcd = (a, b) => {
  let x = a;
  let y = b;
  while (y !== 0n) {
    [x, y] = [y, x % y];
  }
  return x;
};

const isPrime = (num) => {
  if (num <= 1n) return false;
  if (num <= 3n) return true;
  if (num % 2n === 0n || num % 3n === 0n) return false;

  for (let i = 5n; i * i <= num; i += 6n) {
    if (num % i === 0n || num % (i + 2n) === 0n) return false;
  }
  return true;
};

const modPow = (base, exp, m) => {
  let result = 1n;
  let b = mod(base, m);
  let e = exp;

  while (e > 0n) {
    if (e % 2n === 1n) result = mod(result * b, m);
    b = mod(b * b, m);
    e /= 2n;
  }

  return result;
};

const uniquePrimeFactors = (num) => {
  const factors = [];
  let n = num;

  if (n % 2n === 0n) {
    factors.push(2n);
    while (n % 2n === 0n) n /= 2n;
  }

  for (let d = 3n; d * d <= n; d += 2n) {
    if (n % d === 0n) {
      factors.push(d);
      while (n % d === 0n) n /= d;
    }
  }

  if (n > 1n) factors.push(n);
  return factors;
};

const isPrimitiveRoot = (g, p) => {
  if (g <= 1n || g >= p) return false;
  const phi = p - 1n;
  const factors = uniquePrimeFactors(phi);

  for (const factor of factors) {
    if (modPow(g, phi / factor, p) === 1n) return false;
  }

  return true;
};

const findPrimitiveRoots = (p) => {
  const roots = [];
  for (let candidate = 2n; candidate < p; candidate++) {
    if (isPrimitiveRoot(candidate, p)) roots.push(candidate);
  }
  return roots;
};

const parseBigIntField = (id, title) => {
  const raw = document.getElementById(id).value.trim();
  if (!/^-?\d+$/.test(raw)) throw new Error(`${title}: введите целое число.`);
  return BigInt(raw);
};

const validateCommonParams = (needGAndK) => {
  const p = parseBigIntField("p-val", "p");
  const x = parseBigIntField("x-val", "x");

  if (!isPrime(p)) throw new Error("p должно быть простым числом.");
  if (p <= 255n) throw new Error("p должно быть больше 255, чтобы шифровать любой байт.");
  if (p > UINT16_MAX) throw new Error("p должно быть не больше 65535: блоки сохраняются как 16-битные значения.");
  if (x <= 1n || x >= p - 1n) throw new Error("x должно удовлетворять условию 1 < x < p - 1.");

  if (!needGAndK) return { p, x };

  const k = parseBigIntField("k-val", "k");
  const g = parseBigIntField("g-val", "g");

  if (k <= 1n || k >= p - 1n) throw new Error("k должно удовлетворять условию 1 < k < p - 1.");
  if (gcd(k, p - 1n) !== 1n) throw new Error("k должно быть взаимно простым с p - 1.");
  if (!isPrimitiveRoot(g, p)) throw new Error("g должно быть первообразным корнем по модулю p.");

  return { p, x, k, g };
};

const setError = (message = "") => {
  document.getElementById("param-error").textContent = message;
};

const setLoadingOverlay = (visible, message = "Подождите...") => {
  const overlay = document.getElementById("loading-overlay");
  const label = document.getElementById("loading-message");

  label.textContent = message;
  overlay.classList.toggle("is-visible", visible);
  overlay.setAttribute("aria-hidden", visible ? "false" : "true");
};

const deferForPaint = (fn) => {
  requestAnimationFrame(() => requestAnimationFrame(fn));
};

const formatAllBigInts = (values) => values.map(String).join(" ");

const formatByteList = (bytes, limit = DISPLAY_LIMIT) => {
  const count = Math.min(bytes.length, limit);
  const parts = [];

  for (let i = 0; i < count; i++) {
    parts.push(bytes[i].toString());
  }

  const text = parts.join(" ");
  if (bytes.length <= limit) return text;
  return `${text}\n\n... показаны первые ${limit} байт из ${bytes.length}`;
};

const formatBlocks = (blocks, limit = DISPLAY_LIMIT) => {
  const count = Math.min(blocks.length, limit);
  const lines = [];

  for (let i = 0; i < count; i++) {
    lines.push(`(${blocks[i].a}, ${blocks[i].b})`);
  }

  const text = lines.join(" ");
  if (blocks.length <= limit) return text;
  return `${text}\n\n... показаны первые ${limit} блоков из ${blocks.length}`;
};

const downloadFile = (content, fileName, mimeType) => {
  const link = document.createElement("a");
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const updateKeyInfo = () => {
  const info = document.getElementById("key-info");

  try {
    const { p, x } = validateCommonParams(false);
    const gRaw = document.getElementById("g-val").value.trim();

    if (!gRaw) {
      info.textContent = "Выберите g из списка найденных первообразных корней.";
      return;
    }

    const g = BigInt(gRaw);
    if (!isPrimitiveRoot(g, p)) {
      info.textContent = "Выбранное g не является первообразным корнем по модулю p.";
      return;
    }

    const y = modPow(g, x, p);
    info.textContent = `g = ${g}\ny = g^x mod p = ${y}\nОткрытый ключ: (p, g, y) = (${p}, ${g}, ${y})`;
  } catch (err) {
    info.textContent = err.message;
  }
};

const handleFindRoots = () => {
  setError("");

  try {
    const p = parseBigIntField("p-val", "p");
    if (!isPrime(p)) throw new Error("p должно быть простым числом.");
    if (p <= 255n) throw new Error("p должно быть больше 255.");
    if (p > UINT16_MAX) throw new Error("p должно быть не больше 65535.");

    setLoadingOverlay(true, "Поиск первообразных корней...");
    deferForPaint(() => {
      try {
        const roots = findPrimitiveRoots(p);
        cachedRoots = roots;
        cachedRootMod = p;

        document.getElementById("roots-output").value =
          `Найдено корней: ${roots.length}\n${formatAllBigInts(roots)}`;

        if (roots.length > 0) {
          document.getElementById("g-val").value = roots[0].toString();
          updateKeyInfo();
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingOverlay(false);
      }
    });
  } catch (err) {
    setError(err.message);
  }
};

const encryptBytes = (bytes, params) => {
  const { p, x, k, g } = params;
  const y = modPow(g, x, p);
  const a = modPow(g, k, p);
  const yk = modPow(y, k, p);
  const encrypted = new Uint8Array(bytes.length * BLOCK_SIZE);
  const view = new DataView(encrypted.buffer);
  const blocks = [];

  for (let i = 0; i < bytes.length; i++) {
    const m = BigInt(bytes[i]);
    const b = mod(m * yk, p);

    view.setUint16(i * BLOCK_SIZE, Number(a), false);
    view.setUint16(i * BLOCK_SIZE + 2, Number(b), false);
    blocks.push({ a, b });
  }

  return { encrypted, blocks, y };
};

const decryptBytes = (bytes, params) => {
  const { p, x } = params;

  if (bytes.length % BLOCK_SIZE !== 0) {
    throw new Error("Зашифрованный файл должен состоять из 4-байтовых блоков.");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decrypted = new Uint8Array(bytes.length / BLOCK_SIZE);

  for (let i = 0; i < decrypted.length; i++) {
    const a = BigInt(view.getUint16(i * BLOCK_SIZE, false));
    const b = BigInt(view.getUint16(i * BLOCK_SIZE + 2, false));

    if (a <= 0n || a >= p || b < 0n || b >= p) {
      throw new Error(`Блок ${i + 1} не соответствует выбранному p.`);
    }

    const m = mod(b * modPow(a, p - 1n - x, p), p);
    if (m > 255n) {
      throw new Error(`Блок ${i + 1} расшифрован вне диапазона байта 0..255.`);
    }

    decrypted[i] = Number(m);
  }

  return decrypted;
};

const handleEncrypt = () => {
  setError("");

  try {
    const params = validateCommonParams(true);
    const fileInput = document.getElementById("file-encrypt");
    if (!fileInput.files.length) throw new Error("Выберите файл для шифрования.");

    const file = fileInput.files[0];
    setLoadingOverlay(true, "Шифрование...");

    deferForPaint(async () => {
      try {
        const source = new Uint8Array(await file.arrayBuffer());
        const { encrypted, blocks, y } = encryptBytes(source, params);

        document.getElementById("key-info").textContent =
          `g = ${params.g}\ny = g^x mod p = ${y}\nОткрытый ключ: (p, g, y) = (${params.p}, ${params.g}, ${y})`;
        document.getElementById("encrypted-output").value = formatByteList(encrypted);
        document.getElementById("blocks-output").value = formatBlocks(blocks);

        downloadFile(encrypted, `${file.name}.eg`, "application/octet-stream");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingOverlay(false);
      }
    });
  } catch (err) {
    setError(err.message);
  }
};

const handleDecrypt = () => {
  setError("");

  try {
    const params = validateCommonParams(false);
    const fileInput = document.getElementById("file-decrypt");
    if (!fileInput.files.length) throw new Error("Выберите файл для расшифрования.");

    const file = fileInput.files[0];
    setLoadingOverlay(true, "Расшифрование...");

    deferForPaint(async () => {
      try {
        const encrypted = new Uint8Array(await file.arrayBuffer());
        const decrypted = decryptBytes(encrypted, params);
        const outName = file.name.endsWith(".eg")
          ? file.name.slice(0, -3)
          : `decrypted_${file.name}`;

        document.getElementById("encrypted-output").value = formatByteList(encrypted);
        document.getElementById("blocks-output").value = "";
        downloadFile(decrypted, outName, "application/octet-stream");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingOverlay(false);
      }
    });
  } catch (err) {
    setError(err.message);
  }
};

const resetRootsIfPChanged = () => {
  const raw = document.getElementById("p-val").value.trim();
  const current = /^-?\d+$/.test(raw) ? BigInt(raw) : null;

  if (cachedRootMod !== null && current !== cachedRootMod) {
    cachedRoots = [];
    cachedRootMod = null;
    document.getElementById("roots-output").value = "";
    document.getElementById("g-val").value = "";
  }

  updateKeyInfo();
};

document.getElementById("find-roots-btn").addEventListener("click", handleFindRoots);
document.getElementById("encrypt-btn").addEventListener("click", handleEncrypt);
document.getElementById("decrypt-btn").addEventListener("click", handleDecrypt);

for (const id of ["p-val", "x-val", "k-val", "g-val"]) {
  document.getElementById(id).addEventListener("input", id === "p-val" ? resetRootsIfPChanged : updateKeyInfo);
}

updateKeyInfo();
