#!/usr/bin/env python3
"""
NovaReader — Inline PDF Text Editor Engine (Python sidecar)

Accepts JSON commands via stdin, writes JSON result to stdout.
Handles both digital (vector) and scanned (raster) PDF text editing.

Protocol:
  Input  (stdin):  JSON object with "action" + parameters
  Output (stdout): JSON object with "ok" (bool) + "data"/"error"

Dependencies: pymupdf, pytesseract, opencv-python-headless, Pillow, numpy
"""

import sys, json, io, os, base64, traceback
import numpy as np

# ── Lazy imports (fail gracefully if missing) ────────────────────────────────

fitz = None
cv2 = None
Image = ImageDraw = ImageFont = None
pytesseract = None

def _ensure_imports():
    global fitz, cv2, Image, ImageDraw, ImageFont, pytesseract
    if fitz is None:
        import fitz as _fitz; fitz = _fitz
    if cv2 is None:
        import cv2 as _cv2; cv2 = _cv2
    if Image is None:
        from PIL import Image as _I, ImageDraw as _ID, ImageFont as _IF
        Image = _I; ImageDraw = _ID; ImageFont = _IF
    if pytesseract is None:
        import pytesseract as _pt; pytesseract = _pt


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Page Classification
# ═══════════════════════════════════════════════════════════════════════════════

def classify_page(page):
    """Returns 'digital' | 'scan' | 'mixed'."""
    blocks = page.get_text("rawdict")["blocks"]
    vector_chars = sum(
        len(span.get("chars", []))
        for block in blocks if block["type"] == 0
        for line in block.get("lines", [])
        for span in line.get("spans", [])
    )
    images = page.get_images(full=True)
    has_raster = len(images) > 0
    page_area = page.rect.width * page.rect.height
    img_area = 0
    for img in images:
        try:
            info = page.parent.extract_image(img[0])
            img_area += info["width"] * info["height"]
        except Exception:
            pass
    is_large_image = has_raster and (img_area / max(page_area, 1)) > 0.6
    if vector_chars > 20 and not is_large_image:
        return "digital"
    elif is_large_image and vector_chars < 10:
        return "scan"
    return "mixed"


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Digital PDF Editing
# ═══════════════════════════════════════════════════════════════════════════════

def extract_text_spans(page):
    """Extract text spans with full style metadata."""
    result = []
    blocks = page.get_text("rawdict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]
    for block in blocks:
        if block["type"] != 0:
            continue
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                if not span.get("chars"):
                    continue
                result.append({
                    "text":   span.get("text", ""),
                    "bbox":   list(span["bbox"]),
                    "font":   span.get("font", ""),
                    "size":   span.get("size", 12),
                    "color":  span.get("color", 0),
                    "flags":  span.get("flags", 0),
                    "origin": list(span.get("origin", [0, 0])),
                })
    return result


def color_int_to_rgb(c):
    return (((c >> 16) & 0xFF) / 255.0,
            ((c >> 8) & 0xFF) / 255.0,
            (c & 0xFF) / 255.0)


def match_builtin_font(name, bold, italic):
    n = name.lower()
    if any(k in n for k in ("courier", "mono", "code", "consol")):
        base = "cour"
    elif any(k in n for k in ("times", "serif", "roman", "georgia")):
        base = "tiro"
    else:
        base = "helv"
    suffixes = {
        "helv": ("helv", "hebo", "heit", "hebi"),
        "tiro": ("tiro", "tibs", "tiit", "tibi"),
        "cour": ("cour", "cobo", "coit", "cobi"),
    }
    v = suffixes.get(base, suffixes["helv"])
    if bold and italic: return v[3]
    if bold: return v[1]
    if italic: return v[2]
    return v[0]


def edit_digital(doc, page_num, old_text, new_text):
    """Edit text in a digital (vector) PDF page via redact + insert."""
    page = doc[page_num]
    spans = extract_text_spans(page)

    target = None
    for s in spans:
        if old_text.strip() in s["text"] or s["text"].strip() == old_text.strip():
            target = s
            break
    if not target:
        return {"ok": False, "error": f"Text '{old_text}' not found on page {page_num + 1}"}

    bbox = fitz.Rect(target["bbox"])
    # Redact old text
    page.add_redact_annot(bbox, fill=None)
    page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE,
                          graphics=fitz.PDF_REDACT_LINE_ART_NONE)

    color_rgb = color_int_to_rgb(target["color"])
    flags = target["flags"]
    bold = bool(flags & 16)
    italic = bool(flags & 64)
    font_name = match_builtin_font(target["font"], bold, italic)
    font_size = target["size"]

    result = page.insert_textbox(
        rect=bbox, buffer=new_text,
        fontname=font_name, fontsize=font_size,
        color=color_rgb, align=fitz.TEXT_ALIGN_LEFT,
    )
    if result < 0:
        for trial in [font_size * 0.9, font_size * 0.75, 8, 6]:
            result = page.insert_textbox(
                rect=bbox, buffer=new_text,
                fontname=font_name, fontsize=trial,
                color=color_rgb, align=fitz.TEXT_ALIGN_LEFT,
            )
            if result >= 0:
                break

    return {"ok": True, "bbox": list(bbox), "mode": "digital"}


# ═══════════════════════════════════════════════════════════════════════════════
# 3. Scan PDF Editing
# ═══════════════════════════════════════════════════════════════════════════════

def extract_scan_image(doc, page_num, dpi=300):
    """Extract raster image from a scanned page."""
    page = doc[page_num]
    images = page.get_images(full=True)

    # Try direct extraction for single-image pages
    if len(images) == 1:
        xref = images[0][0]
        try:
            raw = doc.extract_image(xref)
            pil = Image.open(io.BytesIO(raw["image"])).convert("RGB")
            return np.array(pil), None, xref
        except Exception:
            pass

    # Fallback: render page at target DPI
    zoom = dpi / 72.0
    matrix = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=matrix, colorspace=fitz.csRGB, alpha=False)
    img_np = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3).copy()
    return img_np, matrix, None


def locate_text_ocr(img_np, search_text, lang="rus+eng"):
    """Find text in image via Tesseract OCR word-level detection."""
    pil_img = Image.fromarray(img_np)
    config = "--oem 3 --psm 3 -c preserve_interword_spaces=1"
    data = pytesseract.image_to_data(pil_img, lang=lang, config=config,
                                      output_type=pytesseract.Output.DICT)
    results = []
    search_lower = search_text.lower().strip()

    n = len(data["text"])
    for i in range(n):
        txt = str(data["text"][i]).strip()
        if not txt:
            continue
        conf = float(data["conf"][i]) if data["conf"][i] != -1 else 0
        if conf < 25:
            continue
        if txt.lower() == search_lower or search_lower in txt.lower():
            results.append({
                "text": txt,
                "bbox": [int(data["left"][i]), int(data["top"][i]),
                         int(data["left"][i]) + int(data["width"][i]),
                         int(data["top"][i]) + int(data["height"][i])],
                "conf": conf,
            })

    # Multi-word: search consecutive words on same line
    if not results and " " in search_text:
        words = search_text.lower().split()
        for i in range(n - len(words) + 1):
            match = True
            for j, w in enumerate(words):
                t = str(data["text"][i + j]).strip().lower()
                if t != w:
                    match = False
                    break
            if match:
                x1 = int(data["left"][i])
                y1 = int(data["top"][i])
                x2 = x1
                y2 = y1
                for j in range(len(words)):
                    k = i + j
                    x2 = max(x2, int(data["left"][k]) + int(data["width"][k]))
                    y2 = max(y2, int(data["top"][k]) + int(data["height"][k]))
                results.append({"text": search_text, "bbox": [x1, y1, x2, y2], "conf": 80})
                break

    return results


def analyze_text_style(img_np, bbox):
    """Analyze font size, color, background, angle from image region."""
    x1, y1, x2, y2 = bbox
    m = 3
    x1m, y1m = max(0, x1 - m), max(0, y1 - m)
    x2m = min(img_np.shape[1], x2 + m)
    y2m = min(img_np.shape[0], y2 + m)
    roi = img_np[y1m:y2m, x1m:x2m]
    if roi.size == 0:
        return {"font_size_px": 16, "text_color": [0, 0, 0],
                "bg_color": [255, 255, 255], "angle": 0.0, "is_bold": False}

    gray = cv2.cvtColor(roi, cv2.COLOR_RGB2GRAY)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Text color: median of dark pixels
    mask = binary > 128
    text_color = [0, 0, 0]
    if np.sum(mask) > 5:
        text_color = np.median(roi[mask], axis=0).astype(int).tolist()

    # Background color: median of light pixels
    bg_mask = binary < 128
    bg_color = [255, 255, 255]
    if np.sum(bg_mask) > 5:
        bg_color = np.median(roi[bg_mask], axis=0).astype(int).tolist()

    # Font size from bbox height
    height_px = y2 - y1
    font_size_px = max(int(height_px / 0.75), 8)

    # Angle via Hough lines
    angle = 0.0
    if roi.shape[1] > 10 and roi.shape[0] > 5:
        lines = cv2.HoughLinesP(binary, 1, np.pi / 180, threshold=10,
                                 minLineLength=roi.shape[1] // 3, maxLineGap=5)
        if lines is not None:
            angles = []
            for ln in lines:
                lx1, ly1, lx2, ly2 = ln[0]
                if lx2 != lx1:
                    a = np.degrees(np.arctan2(ly2 - ly1, lx2 - lx1))
                    if abs(a) < 30:
                        angles.append(a)
            if angles:
                angle = float(np.median(angles))

    # Bold estimation via stroke width
    dist = cv2.distanceTransform(binary, cv2.DIST_L2, 5)
    mean_stroke = np.mean(dist[dist > 0]) * 2 if np.any(dist > 0) else 1
    is_bold = (mean_stroke / max(roi.shape[0], 1)) > 0.15

    return {
        "font_size_px": font_size_px,
        "text_color": text_color,
        "bg_color": bg_color,
        "angle": round(angle, 2),
        "is_bold": is_bold,
    }


def erase_text_inpaint(img_np, bbox, expand_px=4):
    """Erase text via OpenCV inpainting."""
    x1, y1, x2, y2 = bbox
    x1e, y1e = max(0, x1 - expand_px), max(0, y1 - expand_px)
    x2e = min(img_np.shape[1], x2 + expand_px)
    y2e = min(img_np.shape[0], y2 + expand_px)

    result = img_np.copy()
    roi = img_np[y1e:y2e, x1e:x2e].copy()
    gray_roi = cv2.cvtColor(roi, cv2.COLOR_RGB2GRAY)
    _, mask = cv2.threshold(gray_roi, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.dilate(mask, kernel, iterations=1)

    roi_bgr = cv2.cvtColor(roi, cv2.COLOR_RGB2BGR)
    inpainted = cv2.inpaint(roi_bgr, mask, inpaintRadius=5, flags=cv2.INPAINT_TELEA)
    result[y1e:y2e, x1e:x2e] = cv2.cvtColor(inpainted, cv2.COLOR_BGR2RGB)
    return result


def render_text_on_image(img_np, bbox, new_text, style, font_path=None):
    """Render new text onto the image at the given bbox."""
    x1, y1, x2, y2 = bbox
    target_w, target_h = x2 - x1, y2 - y1
    text_color = tuple(style["text_color"])
    font_size = style["font_size_px"]
    angle = style.get("angle", 0.0)

    # Load font
    font = None
    if not font_path:
        font_path = _find_system_font(style.get("is_bold", False))
    for trial in range(font_size, 5, -1):
        try:
            font = ImageFont.truetype(font_path, trial) if font_path else ImageFont.load_default()
        except Exception:
            font = ImageFont.load_default()
            break
        tb = font.getbbox(new_text)
        tw = tb[2] - tb[0]
        if tw <= target_w * 1.1:
            break

    if font is None:
        font = ImageFont.load_default()

    result = img_np.copy()

    if abs(angle) < 0.5:
        # Straight text
        pil_img = Image.fromarray(result)
        draw = ImageDraw.Draw(pil_img)
        tb = font.getbbox(new_text)
        th = tb[3] - tb[1]
        x_pos = x1
        y_pos = y1 + (target_h - th) // 2 - tb[1]
        draw.text((x_pos, y_pos), new_text, font=font, fill=text_color)
        return np.array(pil_img)
    else:
        # Rotated text
        pad = max(target_w, target_h)
        canvas = Image.new("RGBA", (target_w + 2 * pad, target_h + 2 * pad), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        tb = font.getbbox(new_text)
        tw, th = tb[2] - tb[0], tb[3] - tb[1]
        tx = (canvas.width - tw) // 2
        ty = (canvas.height - th) // 2 - tb[1]
        draw.text((tx, ty), new_text, font=font, fill=(*text_color, 255))
        rotated = canvas.rotate(-angle, resample=Image.BICUBIC, expand=False)
        cx, cy = (rotated.width - target_w) // 2, (rotated.height - target_h) // 2
        cropped = rotated.crop((cx, cy, cx + target_w, cy + target_h))
        pil_result = Image.fromarray(result)
        pil_result.paste(cropped, (x1, y1), mask=cropped.split()[3])
        return np.array(pil_result)


def replace_scan_image(doc, page_num, new_img_np, xref, matrix, dpi=300):
    """Replace the page image in the PDF."""
    page = doc[page_num]
    pil_img = Image.fromarray(new_img_np)
    buf = io.BytesIO()
    pil_img.save(buf, format="JPEG", quality=95, dpi=(dpi, dpi))
    img_bytes = buf.getvalue()

    if xref is not None:
        doc.update_stream(xref, img_bytes)
    else:
        for img in page.get_images(full=True):
            try:
                page.delete_image(img[0])
            except Exception:
                pass
        page.insert_image(rect=page.rect, stream=img_bytes, keep_proportion=True)


def edit_scan(doc, page_num, old_text, new_text, lang="rus+eng", dpi=300):
    """Edit text on a scanned PDF page: OCR → inpaint → re-render."""
    img_np, matrix, xref = extract_scan_image(doc, page_num, dpi)

    found = locate_text_ocr(img_np, old_text, lang)
    if not found:
        return {"ok": False, "error": f"OCR could not find '{old_text}' on page {page_num + 1}"}

    match = max(found, key=lambda x: x.get("conf", 0))
    bbox = match["bbox"]
    style = analyze_text_style(img_np, bbox)

    # Erase old text
    img_np = erase_text_inpaint(img_np, bbox)

    # Render new text
    img_np = render_text_on_image(img_np, bbox, new_text, style)

    # Write back to PDF
    replace_scan_image(doc, page_num, img_np, xref, matrix, dpi)

    return {"ok": True, "bbox": bbox, "mode": "scan", "style": style}


def _find_system_font(is_bold):
    """Find a suitable system font."""
    import subprocess
    candidates = [
        ("LiberationSans-Bold", True), ("DejaVuSans-Bold", True),
        ("LiberationSans-Regular", False), ("DejaVuSans", False),
        ("FreeSans", True),
    ]
    try:
        result = subprocess.run(["fc-list", "--format=%{file}\n"],
                                 capture_output=True, text=True, timeout=5)
        all_fonts = result.stdout.strip().split("\n")
        for hint, need_bold in candidates:
            if is_bold != need_bold:
                continue
            for path in all_fonts:
                if hint.lower() in path.lower():
                    return path
        for path in all_fonts:
            if path.endswith((".ttf", ".otf")):
                return path
    except Exception:
        pass
    return ""


# ═══════════════════════════════════════════════════════════════════════════════
# 4. High-Level Edit Command
# ═══════════════════════════════════════════════════════════════════════════════

def handle_edit(cmd):
    """
    Main edit handler.
    cmd: {
      "input_path": str,
      "output_path": str,
      "edits": [{"page": int (1-based), "old_text": str, "new_text": str}],
      "lang": str (default "rus+eng"),
      "dpi": int (default 300)
    }
    """
    _ensure_imports()

    input_path = cmd["input_path"]
    output_path = cmd["output_path"]
    edits = cmd["edits"]
    lang = cmd.get("lang", "rus+eng")
    dpi = cmd.get("dpi", 300)

    doc = fitz.open(input_path)
    results = []

    # Cache page images for multiple edits on same page
    page_images = {}

    for edit in edits:
        page_num = edit["page"] - 1  # 1-based → 0-based
        old_text = edit["old_text"]
        new_text = edit["new_text"]

        if page_num < 0 or page_num >= len(doc):
            results.append({"ok": False, "error": f"Page {edit['page']} out of range"})
            continue

        page_type = classify_page(doc[page_num])

        if page_type == "digital":
            r = edit_digital(doc, page_num, old_text, new_text)
        elif page_type == "scan":
            r = edit_scan(doc, page_num, old_text, new_text, lang, dpi)
        else:
            # Mixed: try digital first, fallback to scan
            r = edit_digital(doc, page_num, old_text, new_text)
            if not r["ok"]:
                r = edit_scan(doc, page_num, old_text, new_text, lang, dpi)

        results.append(r)

    doc.save(output_path, deflate=True, deflate_images=True, garbage=4, clean=True)
    doc.close()

    return {"ok": True, "results": results, "output_path": output_path}


def handle_classify(cmd):
    """Classify pages in a PDF."""
    _ensure_imports()
    doc = fitz.open(cmd["input_path"])
    pages = []
    for i in range(len(doc)):
        pages.append({"page": i + 1, "type": classify_page(doc[i])})
    doc.close()
    return {"ok": True, "pages": pages}


def handle_extract_spans(cmd):
    """Extract text spans with style from a page."""
    _ensure_imports()
    doc = fitz.open(cmd["input_path"])
    page_num = cmd.get("page", 1) - 1
    if page_num < 0 or page_num >= len(doc):
        doc.close()
        return {"ok": False, "error": "Page out of range"}
    spans = extract_text_spans(doc[page_num])
    page_type = classify_page(doc[page_num])
    doc.close()
    return {"ok": True, "spans": spans, "page_type": page_type}


def handle_ocr_locate(cmd):
    """Locate text in a scanned page via OCR."""
    _ensure_imports()
    doc = fitz.open(cmd["input_path"])
    page_num = cmd.get("page", 1) - 1
    dpi = cmd.get("dpi", 300)
    lang = cmd.get("lang", "rus+eng")
    search = cmd["search_text"]

    img_np, _, _ = extract_scan_image(doc, page_num, dpi)
    doc.close()

    found = locate_text_ocr(img_np, search, lang)
    results = []
    for f in found:
        style = analyze_text_style(img_np, f["bbox"])
        results.append({**f, "style": style})

    return {"ok": True, "results": results}


# ═══════════════════════════════════════════════════════════════════════════════
# 5. Main Entry Point (JSON stdin/stdout protocol)
# ═══════════════════════════════════════════════════════════════════════════════

HANDLERS = {
    "edit": handle_edit,
    "classify": handle_classify,
    "extract_spans": handle_extract_spans,
    "ocr_locate": handle_ocr_locate,
}

def main():
    try:
        raw = sys.stdin.read()
        cmd = json.loads(raw)
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"Invalid JSON input: {e}"}))
        sys.exit(1)

    action = cmd.get("action", "")
    handler = HANDLERS.get(action)
    if not handler:
        print(json.dumps({"ok": False, "error": f"Unknown action: {action}"}))
        sys.exit(1)

    try:
        result = handler(cmd)
        print(json.dumps(result, ensure_ascii=False, default=str))
    except Exception as e:
        print(json.dumps({
            "ok": False,
            "error": str(e),
            "traceback": traceback.format_exc(),
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
