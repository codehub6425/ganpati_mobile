import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import sharp from "sharp";
import { encodePngRgb, zipStore } from "@/lib/png-zip";
import { resolveStickerSize } from "@/lib/qr-sticker-sizes";

export { SHEET_FORMATS, STICKER_SIZES, layoutHint, resolveSheet, resolveStickerSize, sheetFormatIds, stickerSizeIds } from "@/lib/qr-sticker-sizes";

const PNG_DPI = 180;
/** Warn in API/UI above this; still generate all sheets. */
export const PNG_SHEET_WARN = 40;

const FOOTER_RESERVE_MM = 8;
const STICKER_GUTTER_MM = 2;
const STICKER_PAD_MM = 1.5;
const CUT_LINE_GRAY = 160;

function labelBandMm(layout) {
  return layout.labelGap + layout.fontSize * 0.35 + 1.5;
}

/** Fixed pitch grid: sticker size + small gutter (no stretching to fill the sheet). */
function layoutBox(layout, codesOnPage = layout.perPage) {
  const page = layout.sheet;
  const innerW = page.widthMm - page.marginMm * 2;
  const innerH = page.heightMm - page.marginMm * 2 - FOOTER_RESERVE_MM;
  const cols = layout.cols;
  const rowsMax = layout.rows;
  const count = Math.max(1, Math.min(codesOnPage, layout.perPage));
  const rowsUsed = Math.min(rowsMax, Math.max(1, Math.ceil(count / cols)));
  const labelBand = labelBandMm(layout);

  const maxQrW = (innerW + STICKER_GUTTER_MM) / cols - STICKER_GUTTER_MM - STICKER_PAD_MM * 2;
  const maxQrH =
    (innerH + STICKER_GUTTER_MM) / rowsMax - STICKER_GUTTER_MM - labelBand - STICKER_PAD_MM * 2;
  const qrSize = Math.min(layout.qrMm, maxQrW, maxQrH, 80);

  const stickerW = qrSize + STICKER_PAD_MM * 2;
  const stickerH = STICKER_PAD_MM + qrSize + labelBand + STICKER_PAD_MM;
  const pitchW = stickerW + STICKER_GUTTER_MM;
  const pitchH = stickerH + STICKER_GUTTER_MM;
  const blockW = cols * pitchW - STICKER_GUTTER_MM;
  const blockH = rowsUsed * pitchH - STICKER_GUTTER_MM;
  const originX = page.marginMm + Math.max(0, (innerW - blockW) / 2);
  const originY = page.marginMm;

  return {
    page,
    innerW,
    innerH,
    cols,
    rowsUsed,
    qrSize,
    labelBand,
    stickerW,
    stickerH,
    pitchW,
    pitchH,
    originX,
    originY,
    perPage: layout.perPage,
  };
}

function stickerSlot(box, col, row) {
  const stickerX = box.originX + col * box.pitchW;
  const stickerY = box.originY + row * box.pitchH;
  return {
    stickerX,
    stickerY,
    qrX: stickerX + STICKER_PAD_MM,
    qrY: stickerY + STICKER_PAD_MM,
    centerX: stickerX + box.stickerW / 2,
  };
}

function drawStickerCutSquare(doc, x, y, w, h) {
  const tick = 2.5;
  doc.setDrawColor(CUT_LINE_GRAY);
  doc.setLineWidth(0.12);
  doc.rect(x, y, w, h);
  doc.setLineWidth(0.2);
  doc.setDrawColor(60);
  const corners = [
    [x, y, -1, -1],
    [x + w, y, 1, -1],
    [x, y + h, -1, 1],
    [x + w, y + h, 1, 1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    doc.line(cx, cy, cx + dx * tick, cy);
    doc.line(cx, cy, cx, cy + dy * tick);
  }
}

function drawHLineRgb(rgb, width, height, x0, y, x1, r, g, b) {
  const y0 = Math.max(0, Math.min(height - 1, Math.round(y)));
  const xa = Math.max(0, Math.floor(Math.min(x0, x1)));
  const xb = Math.min(width - 1, Math.ceil(Math.max(x0, x1)));
  let i = (y0 * width + xa) * 3;
  for (let x = xa; x <= xb; x++) {
    rgb[i] = r;
    rgb[i + 1] = g;
    rgb[i + 2] = b;
    i += 3;
  }
}

function drawVLineRgb(rgb, width, height, x, y0, y1, r, g, b) {
  const x0 = Math.max(0, Math.min(width - 1, Math.round(x)));
  const ya = Math.max(0, Math.floor(Math.min(y0, y1)));
  const yb = Math.min(height - 1, Math.ceil(Math.max(y0, y1)));
  for (let y = ya; y <= yb; y++) {
    const i = (y * width + x0) * 3;
    rgb[i] = r;
    rgb[i + 1] = g;
    rgb[i + 2] = b;
  }
}

function drawStickerCutSquareRgb(rgb, width, height, pxPerMm, xMm, yMm, wMm, hMm) {
  const x = xMm * pxPerMm;
  const y = yMm * pxPerMm;
  const w = wMm * pxPerMm;
  const h = hMm * pxPerMm;
  const g = CUT_LINE_GRAY;
  drawHLineRgb(rgb, width, height, x, y, x + w, g, g, g);
  drawHLineRgb(rgb, width, height, x, y + h, x + w, g, g, g);
  drawVLineRgb(rgb, width, height, x, y, y + h, g, g, g);
  drawVLineRgb(rgb, width, height, x + w, y, y + h, g, g, g);
}

function drawCropMarks(doc, page) {
  const m = page.marginMm;
  const w = page.widthMm;
  const h = page.heightMm;
  const len = 6;
  doc.setDrawColor(40);
  doc.setLineWidth(0.2);
  const marks = [
    [m, 0, m, len],
    [0, m, len, m],
    [w - m, 0, w - m, len],
    [w - len, m, w, m],
    [m, h - len, m, h],
    [0, h - m, len, h - m],
    [w - m, h - len, w - m, h],
    [w - len, h - m, w, h - m],
  ];
  for (const [x1, y1, x2, y2] of marks) doc.line(x1, y1, x2, y2);
}

export async function buildQrBatchPdf(codes, { prefix = "GMP", size = "medium", sheet = "press12x18", payloadForCode } = {}) {
  const layout = resolveStickerSize(size, sheet);
  const page = layout.sheet;
  const doc = new jsPDF({ unit: "mm", format: [page.widthMm, page.heightMm] });
  const toPayload = typeof payloadForCode === "function" ? payloadForCode : (code) => code;
  const perPage = layout.perPage;
  const pageCount = Math.max(1, Math.ceil(codes.length / perPage));

  for (let p = 0; p < pageCount; p++) {
    if (p > 0) doc.addPage([page.widthMm, page.heightMm]);
    const slice = codes.slice(p * perPage, p * perPage + perPage);
    const box = layoutBox(layout, slice.length);

    for (let i = 0; i < slice.length; i++) {
      const col = i % box.cols;
      const row = Math.floor(i / box.cols);
      const slot = stickerSlot(box, col, row);
      drawStickerCutSquare(doc, slot.stickerX, slot.stickerY, box.stickerW, box.stickerH);
      const code = slice[i];
      const dataUrl = await QRCode.toDataURL(toPayload(code), { margin: 0, width: 200, errorCorrectionLevel: "M" });
      doc.addImage(dataUrl, "PNG", slot.qrX, slot.qrY, box.qrSize, box.qrSize);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(layout.fontSize);
      doc.setTextColor(20);
      doc.text(code, slot.centerX, slot.qrY + box.qrSize + layout.labelGap, { align: "center" });
    }
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    if (page.cropMarks) drawCropMarks(doc, page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(
      `QR stickers — ${prefix} · ${layout.qrMm} mm · ${page.label} · sheet ${p}/${pageCount}`,
      page.marginMm,
      page.heightMm - 3.5
    );
  }

  return Buffer.from(doc.output("arraybuffer"));
}

function fillRect(rgb, width, height, x, y, w, h, r, g, b) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(width, Math.ceil(x + w));
  const y1 = Math.min(height, Math.ceil(y + h));
  for (let py = y0; py < y1; py++) {
    let i = (py * width + x0) * 3;
    for (let px = x0; px < x1; px++) {
      rgb[i] = r;
      rgb[i + 1] = g;
      rgb[i + 2] = b;
      i += 3;
    }
  }
}

function blitQrMatrix(rgb, width, height, x, y, sizePx, payload) {
  const qr = QRCode.create(payload, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const pad = 2;
  const total = n + pad * 2;
  const mod = sizePx / total;
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (!qr.modules.get(col, row)) continue;
      fillRect(
        rgb,
        width,
        height,
        x + (col + pad) * mod,
        y + (row + pad) * mod,
        Math.max(1, Math.ceil(mod)),
        Math.max(1, Math.ceil(mod)),
        0,
        0,
        0
      );
    }
  }
}

function escapeSvgText(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function renderSheetPng(codes, layout, { payloadForCode, sheetIndex = 0 }) {
  const page = layout.sheet;
  const perPage = layout.perPage;
  const start = sheetIndex * perPage;
  const slice = codes.slice(start, start + perPage);
  const box = layoutBox(layout, slice.length);
  const width = Math.round((page.widthMm / 25.4) * PNG_DPI);
  const height = Math.round((page.heightMm / 25.4) * PNG_DPI);
  const pxPerMm = PNG_DPI / 25.4;
  const rgb = Buffer.alloc(width * height * 3, 255);
  const toPayload = typeof payloadForCode === "function" ? payloadForCode : (code) => code;
  const composites = [];
  const fontPx = Math.max(10, Math.round(layout.fontSize * pxPerMm * 0.38));
  const qrPx = box.qrSize * pxPerMm;

  for (let i = 0; i < slice.length; i++) {
    const code = slice[i];
    const col = i % box.cols;
    const row = Math.floor(i / box.cols);
    const slot = stickerSlot(box, col, row);
    drawStickerCutSquareRgb(rgb, width, height, pxPerMm, slot.stickerX, slot.stickerY, box.stickerW, box.stickerH);
    const x = slot.qrX * pxPerMm;
    const y = slot.qrY * pxPerMm;
    blitQrMatrix(rgb, width, height, x, y, qrPx, toPayload(code));

    const labelW = Math.min(box.stickerW * pxPerMm - 4, Math.max(80, code.length * fontPx * 0.55));
    const labelX = slot.centerX * pxPerMm - labelW / 2;
    const labelY = y + qrPx + layout.labelGap * pxPerMm;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(labelW)}" height="${fontPx + 6}">
      <text x="50%" y="${fontPx + 1}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${fontPx}" font-weight="700" fill="#141414">${escapeSvgText(code)}</text>
    </svg>`;
    composites.push({
      input: Buffer.from(svg),
      top: Math.round(labelY),
      left: Math.round(Math.max(0, labelX)),
    });
  }

  const basePng = encodePngRgb(width, height, rgb);
  if (!composites.length) return basePng;
  return sharp(basePng).composite(composites).png().toBuffer();
}

export async function buildQrBatchImages(codes, { prefix = "GMP", size = "medium", sheet = "press12x18", payloadForCode } = {}) {
  const layout = resolveStickerSize(size, sheet);
  const perPage = layout.perPage;
  const totalSheets = Math.max(1, Math.ceil(codes.length / perPage));
  const files = [];
  for (let i = 0; i < totalSheets; i++) {
    const png = await renderSheetPng(codes, layout, { payloadForCode, sheetIndex: i, prefix });
    files.push({
      name: `qr-${layout.sheet.id}-${layout.id}-sheet-${String(i + 1).padStart(2, "0")}.png`,
      data: png,
    });
  }
  if (files.length === 1) {
    return {
      buffer: files[0].data,
      contentType: "image/png",
      filename: files[0].name,
      sheets: 1,
      totalSheets,
    };
  }
  return {
    buffer: zipStore(files),
    contentType: "application/zip",
    filename: `qr-${layout.sheet.id}-${layout.id}-sheets.zip`,
    sheets: files.length,
    totalSheets,
  };
}
