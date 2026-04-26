import copy
import shutil
import tempfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parent
DOCX = ROOT / "Отчёт - ТИ 3.docx"
BACKUP = ROOT / "Отчёт - ТИ 3.original-format-backup.docx"
REPORT_DIR = ROOT / "report_screenshots"

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
XML = "http://www.w3.org/XML/1998/namespace"

ET.register_namespace("w", W)
ET.register_namespace("a", A)
ET.register_namespace("r", R)
ET.register_namespace("wp", "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing")
ET.register_namespace("pic", "http://schemas.openxmlformats.org/drawingml/2006/picture")


def q(ns, tag):
    return f"{{{ns}}}{tag}"


def text_of(element):
    return "".join(t.text or "" for t in element.iter(q(W, "t")))


def set_text(element, value):
    texts = list(element.iter(q(W, "t")))
    if not texts:
        return
    texts[0].text = value
    if value.startswith(" ") or value.endswith(" ") or "  " in value:
        texts[0].set(q(XML, "space"), "preserve")
    for text in texts[1:]:
        text.text = ""


def set_table(table, rows):
    existing_rows = table.findall(q(W, "tr"))
    while len(existing_rows) < len(rows):
        table.append(copy.deepcopy(existing_rows[-1]))
        existing_rows = table.findall(q(W, "tr"))

    for row_element, row_values in zip(existing_rows, rows):
        cells = row_element.findall(q(W, "tc"))
        for cell, value in zip(cells, row_values):
            set_text(cell, value)


def replace_paragraphs(document_root):
    replacements = {
        "Все тесты запускаются на значениях p = 523, q = 5003, b = 1234":
            "Все тесты запускаются с параметрами алгоритма Эль-Гамаля: p = 257, x = 37, k = 71, g = 3. Открытый ключ: y = g^x mod p = 132, то есть (p, g, y) = (257, 3, 132).",
        "Задача: Вычислить 7^13 mod 61 = 7 * 7^12 mod 61 = 7 * 49^6 mod 61 = 7 * 22^3 mod 61 = 32 * 22^2 mod 61 = 32 * 57^1 mod 61 = 55":
            "Задача: вычислить 7^13 mod 71 = 7 * 7^12 mod 71 = 7 * 49^6 mod 71 = 7 * 58^3 mod 71 = 51 * 58^2 mod 71 = 51 * 27 mod 71 = 28",
        "Задано простое p = 61":
            "Задано простое p = 71",
        "Ищем простые делители p - 1 = 60 = 2^2 * 3 * 5. Простые делители: 2, 3, 5.":
            "Ищем простые делители p - 1 = 70 = 2 * 5 * 7. Простые делители: 2, 5, 7.",
        "Проверяем, является ли случайное число 2 первообразным корнем по модулю 61:":
            "Проверяем, является ли число 7 первообразным корнем по модулю 71:",
        "2^(60/2) mod 61 = 60;   2^(60/3) mod 61 = 47;   2^(60/5) mod 61 = 9.":
            "7^(70/2) mod 71 = 70;   7^(70/5) mod 71 = 54;   7^(70/7) mod 71 = 45.",
        "Число 2 является первообразным по модулю 61.":
            "Число 7 является первообразным по модулю 71.",
        "Для нахождения остальных корней используем формулу g_i = g^k (mod p), где k — числа, взаимно простые с p-1 (то есть НОД(k, 60) = 1).":
            "Для нахождения остальных корней используем формулу g_i = g^k (mod p), где k - числа, взаимно простые с p - 1 (то есть НОД(k, 70) = 1).",
        "Взаимно простые числа (k): 1, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 49, 53, 59":
            "Взаимно простые числа (k): 1, 3, 9, 11, 13, 17, 19, 23, 27, 29, 31, 37, 39, 41, 43, 47, 51, 53, 57, 59, 61, 63, 67, 69",
        "Вычисляем 2^k mod 61 для каждого k:":
            "Вычисляем 7^k mod 71 для каждого k:",
        "2^1 mod 61 = 2,  2^7 mod 61 = 6,  2^11 mod 61 = 35,  2^13 mod 61 = 18":
            "7^1 mod 71 = 7,  7^3 mod 71 = 59,  7^9 mod 71 = 47,  7^11 mod 71 = 31,  7^13 mod 71 = 28,  7^17 mod 71 = 62",
        "2^17 mod 61 = 44,  2^19 mod 61 = 54,  2^23 mod 61 = 10,  2^29 mod 61 = 30":
            "7^19 mod 71 = 56,  7^23 mod 71 = 53,  7^27 mod 71 = 21,  7^29 mod 71 = 35,  7^31 mod 71 = 11,  7^37 mod 71 = 22",
        "2^31 mod 61 = 59,  2^37 mod 61 = 55,  2^41 mod 61 = 26,  2^43 mod 61 = 43":
            "7^39 mod 71 = 13,  7^41 mod 71 = 69,  7^43 mod 71 = 44,  7^47 mod 71 = 67,  7^51 mod 71 = 52,  7^53 mod 71 = 63",
        "2^47 mod 61 = 17,  2^49 mod 61 = 7,  2^53 mod 61 = 51,  2^59 mod 61 = 31":
            "7^57 mod 71 = 33,  7^59 mod 71 = 55,  7^61 mod 71 = 68,  7^63 mod 71 = 66,  7^67 mod 71 = 65,  7^69 mod 71 = 61",
        "Итоговый список всех первообразных корней: 2, 6, 7, 10, 17, 18, 26, 30, 31, 35, 43, 44, 51, 54, 55, 59":
            "Итоговый список всех первообразных корней по модулю 71: 7, 11, 13, 21, 22, 28, 31, 33, 35, 42, 44, 47, 52, 53, 55, 56, 59, 61, 62, 63, 65, 67, 68, 69",
        "x1 * a + y1 * b = НОД(a,b), a = 48, b = 61, (a,b) = 1":
            "Для сеансового ключа k = 71 и p = 257 проверяем условие НОД(k, p - 1) = 1, то есть НОД(71, 256) = 1",
        "x1 = 14   y1 = -11":
            "x = 119   y = -33",
        "14 * 48 + (-11) * 61 = 1":
            "119 * 71 + (-33) * 256 = 1. Следовательно, сеансовый ключ k = 71 допустим.",
    }

    found = set()
    for paragraph in document_root.iter(q(W, "p")):
        paragraph_text = text_of(paragraph)
        if paragraph_text in replacements:
            set_text(paragraph, replacements[paragraph_text])
            found.add(paragraph_text)

    missing = sorted(set(replacements) - found)
    if missing:
        raise RuntimeError("Could not find paragraphs: " + "; ".join(missing))


def replace_tables(document_root):
    tables = list(document_root.iter(q(W, "tbl")))
    if len(tables) < 2:
        raise RuntimeError("Expected at least two tables in the DOCX.")

    set_table(tables[0], [
        ["a1 (основание)", "Z (степень)", "x (результат)", "Шаг"],
        ["7", "13", "1", "0"],
        ["7", "12", "(1 * 7) mod 71 = 7", "1"],
        ["(7 * 7) mod 71 = 49", "6", "7", "2"],
        ["(49 * 49) mod 71 = 58", "3", "7", "3"],
        ["58", "2", "(7 * 58) mod 71 = 51", "4"],
        ["(58 * 58) mod 71 = 27", "1", "51", "5"],
        ["27", "0", "(51 * 27) mod 71 = 28", "6"],
    ])

    set_table(tables[1], [
        ["итерация", "q", "a0", "a1", "x0", "x1", "y0", "y1"],
        ["0", "-", "71", "256", "1", "0", "0", "1"],
        ["1", "0", "256", "71", "0", "1", "1", "0"],
        ["2", "3", "71", "43", "1", "-3", "0", "1"],
        ["3", "1", "43", "28", "-3", "4", "1", "-1"],
        ["4", "1", "28", "15", "4", "-7", "-1", "2"],
        ["5", "1", "15", "13", "-7", "11", "2", "-3"],
        ["6", "1", "13", "2", "11", "-18", "-3", "5"],
        ["7", "6", "2", "1", "-18", "119", "5", "-33"],
        ["8", "2", "1", "0", "119", "-256", "-33", "71"],
    ])


def media_replacements(document_root, rels_root):
    rel_targets = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in rels_root
        if "Id" in rel.attrib and "Target" in rel.attrib
    }
    media_targets = []
    for blip in document_root.iter(q(A, "blip")):
        rel_id = blip.attrib.get(q(R, "embed"))
        target = rel_targets.get(rel_id)
        if target and target.startswith("media/"):
            media_targets.append("word/" + target)

    screenshots = [
        "01_text_01_params.png",
        "01_text_02_roots.png",
        "01_text_03_encrypt_selected.png",
        "01_text_11_original_hex.png",
        "01_text_04_encrypted_bytes.png",
        "01_text_05_encrypted_blocks.png",
        "01_text_12_encrypted_hex.png",
        "01_text_07_decrypt_selected.png",
        "01_text_13_decrypted_hex.png",
        "02_video_01_params.png",
        "02_video_02_roots.png",
        "02_video_03_encrypt_selected.png",
        "02_video_11_original_hex.png",
        "02_video_04_encrypted_bytes.png",
        "02_video_05_encrypted_blocks.png",
        "02_video_12_encrypted_hex.png",
        "02_video_07_decrypt_selected.png",
        "02_video_13_decrypted_hex.png",
        "03_audio_01_params.png",
        "03_audio_02_roots.png",
        "03_audio_03_encrypt_selected.png",
        "03_audio_11_original_hex.png",
        "03_audio_04_encrypted_bytes.png",
        "03_audio_05_encrypted_blocks.png",
        "03_audio_12_encrypted_hex.png",
        "03_audio_07_decrypt_selected.png",
        "03_audio_13_decrypted_hex.png",
        "04_image_01_params.png",
        "04_image_02_roots.png",
        "04_image_03_encrypt_selected.png",
        "04_image_11_original_hex.png",
        "04_image_04_encrypted_bytes.png",
        "04_image_05_encrypted_blocks.png",
        "04_image_12_encrypted_hex.png",
        "04_image_07_decrypt_selected.png",
        "04_image_13_decrypted_hex.png",
        "05_wrongkey_01_wrong_params.png",
        "05_wrongkey_02_wrong_decrypt_selected.png",
        "05_wrongkey_05_encrypted_hex.png",
        "05_wrongkey_06_wrong_decrypted_hex.png",
        "05_wrongkey_04_wrong_full.png",
    ]

    if len(media_targets) != len(screenshots):
        raise RuntimeError(f"Expected {len(screenshots)} image slots, found {len(media_targets)}.")

    replacements = {}
    for media_target, screenshot in zip(media_targets, screenshots):
        path = REPORT_DIR / screenshot
        if not path.exists():
            raise RuntimeError(f"Missing screenshot: {path}")
        replacements[media_target] = path.read_bytes()
    return replacements


def main():
    if not DOCX.exists():
        raise RuntimeError(f"Missing DOCX: {DOCX}")
    if not BACKUP.exists():
        shutil.copy2(DOCX, BACKUP)

    with ZipFile(DOCX, "r") as zin:
        document_root = ET.fromstring(zin.read("word/document.xml"))
        rels_root = ET.fromstring(zin.read("word/_rels/document.xml.rels"))

        replace_paragraphs(document_root)
        replace_tables(document_root)

        replacements = media_replacements(document_root, rels_root)
        replacements["word/document.xml"] = ET.tostring(
            document_root,
            encoding="utf-8",
            xml_declaration=True,
        )

        with tempfile.NamedTemporaryFile(delete=False, suffix=".docx", dir=ROOT) as tmp:
            tmp_path = Path(tmp.name)

        try:
            with ZipFile(tmp_path, "w", ZIP_DEFLATED) as zout:
                for item in zin.infolist():
                    data = replacements.get(item.filename)
                    if data is None:
                        data = zin.read(item.filename)
                    zout.writestr(item, data)
            shutil.move(tmp_path, DOCX)
        finally:
            if tmp_path.exists():
                tmp_path.unlink()

    print(f"Updated {DOCX.name}; backup saved as {BACKUP.name}")


if __name__ == "__main__":
    main()
