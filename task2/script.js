const textInput = document.getElementById("textInput");
const fileInput = document.getElementById("fileInput");
const passwordInput = document.getElementById("keyInput");
const registerError = document.getElementById("registerError");
const output = document.getElementById("output");
const generateKeyButton = document.getElementById("generateKeyButton");
const lfsrKeyOutput = document.getElementById("lfsrKeyOutput");
const outputKey = document.getElementById("key");
const downloadButton = document.getElementById("downloadButton");
const keyCounter = document.getElementById("keyCounter");
const fileNameSpan = document.getElementById("fileName");

const REGISTER_LENGTH = 24;
const FORMULA = [1, 2, 7, 24];
const DISPLAY_LIMIT = 5000;

let currentSourceBytes = new Uint8Array(0);
let encryptedResultBytes = new Uint8Array(0);
let currentFileName = "data.bin";

function validateRegisterInput() {
  const v = passwordInput.value;
  if (v.length === 0) {
    registerError.textContent = "";
    passwordInput.classList.remove("invalid");
    return true;
  }
  if (v.length < REGISTER_LENGTH) {
    registerError.textContent = `Введите ровно ${REGISTER_LENGTH} символов (сейчас ${v.length}).`;
    passwordInput.classList.add("invalid");
    return false;
  }
  registerError.textContent = "";
  passwordInput.classList.remove("invalid");
  return true;
}

passwordInput.addEventListener("input", () => {
  const filtered = passwordInput.value.replace(/[^01]/g, "");
  if (filtered !== passwordInput.value) {
    passwordInput.value = filtered;
  }
  keyCounter.textContent = `${passwordInput.value.length}/${REGISTER_LENGTH}`;
  validateRegisterInput();
});

passwordInput.addEventListener("blur", validateRegisterInput);

function bytesToBitsString(bytes, totalLength = null) {
  if (bytes.length === 0) return "";
  let bitsString = "";
  const lengthToProcess = Math.min(bytes.length, DISPLAY_LIMIT);

  const actualTotalLength = totalLength !== null ? totalLength : bytes.length;

  for (let i = 0; i < lengthToProcess; i++) {
    bitsString += bytes[i].toString(2).padStart(8, "0") + " ";
  }

  if (actualTotalLength > DISPLAY_LIMIT) {
    bitsString += `\n\n... [Показаны первые ${DISPLAY_LIMIT} байт из ${actualTotalLength}]`;
  }
  return bitsString;
}

function resetOutputs() {
  downloadButton.style.display = "none";
  lfsrKeyOutput.textContent = "Здесь появятся биты сгенерированного ключа...";
  outputKey.textContent = "Здесь появятся биты результата...";
  encryptedResultBytes = new Uint8Array(0);
}

textInput.addEventListener("input", () => {
  const text = textInput.value;
  const encoder = new TextEncoder();
  currentSourceBytes = encoder.encode(text);
  output.textContent =
    bytesToBitsString(currentSourceBytes) ||
    "Здесь появятся биты исходных данных...";

  currentFileName = "encrypted_text.bin";
  resetOutputs();

  if (text.length > 0) fileInput.value = "";
});

fileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  textInput.value = "";
  output.textContent = "Чтение файла...";
  resetOutputs();

  fileNameSpan.textContent = file.name;

  if (file.name.endsWith(".enc")) {
    currentFileName = file.name.replace(".enc", "");
  } else {
    currentFileName = file.name + ".enc";
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    currentSourceBytes = new Uint8Array(arrayBuffer);
    output.textContent = bytesToBitsString(currentSourceBytes);
  } catch (err) {
    output.textContent = "Ошибка при чтении файла: " + err.message;
    currentSourceBytes = new Uint8Array(0);
  }
});

function encrypt(sourceBytes, initialKey) {
  const len = sourceBytes.length;
  const result = new Uint8Array(len);
  const state = Array.from(initialKey, (char) => (char === "1" ? 1 : 0));

  const keyPreviewLength = Math.min(len, DISPLAY_LIMIT);
  const keyPreviewBytes = new Uint8Array(keyPreviewLength);

  for (let i = 0; i < len; i++) {
    let generatedKeyByte = 0;

    for (let b = 0; b < 8; b++) {
      let xor = 0;
      for (let j = 0; j < FORMULA.length; j++) {
        xor ^= state[state.length - FORMULA[j]];
      }

      generatedKeyByte |= state[0] << (7 - b);

      state.shift();
      state.push(xor);
    }

    if (i < keyPreviewLength) {
      keyPreviewBytes[i] = generatedKeyByte;
    }

    result[i] = sourceBytes[i] ^ generatedKeyByte;
  }

  return { result, keyPreviewBytes };
}

generateKeyButton.addEventListener("click", () => {
  const key = passwordInput.value;

  if (currentSourceBytes.length === 0) {
    outputKey.textContent = "Сначала введите текст или выберите файл.";
    return;
  }
  if (key.length !== REGISTER_LENGTH) {
    outputKey.textContent = `Ключ должен быть ровно ${REGISTER_LENGTH} символов.`;
    return;
  }

  outputKey.textContent = "Выполнение... Подождите.";
  lfsrKeyOutput.textContent = "Генерация...";
  downloadButton.style.display = "none";

  setTimeout(() => {
    const { result, keyPreviewBytes } = encrypt(currentSourceBytes, key);
    encryptedResultBytes = result;

    lfsrKeyOutput.textContent = bytesToBitsString(
      keyPreviewBytes,
      currentSourceBytes.length,
    );
    outputKey.textContent = bytesToBitsString(encryptedResultBytes);
    downloadButton.style.display = "inline-block";
  }, 10);
});

downloadButton.addEventListener("click", () => {
  if (encryptedResultBytes.length === 0) return;

  const blob = new Blob([encryptedResultBytes], {
    type: "application/octet-stream",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = currentFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});
