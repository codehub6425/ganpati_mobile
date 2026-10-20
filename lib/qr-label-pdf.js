import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { encodePngRgb, zipStore } from "@/lib/png-zip";
import { resolveStickerSize } from "@/lib/qr-sticker-sizes";

export { SHEET_FORMATS, STICKER_SIZES, layoutHint, resolveSheet, resolveStickerSize, sheetFormatIds, stickerSizeIds } from "@/lib/qr-sticker-sizes";

const PNG_DPI = 180;
const PNG_SHEET_CAP = 15;

function layoutBox(layout) {
  const page = layout.sheet;
  const innerW = page.widthMm - page.marginMm * 2;
  const innerH = page.heightMm - page.marginMm * 2;
  return {
    page,
    innerW,
    innerH,
    cellW: innerW / layout.cols,
    cellH: innerH / layout.rows,
    qrSize: Math.min(innerW / layout.cols - 3, layout.qrMm),
    perPage: layout.perPage,
  };
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
  const box = layoutBox(layout);
  const page = layout.sheet;
  const doc = new jsPDF({ unit: "mm", format: [page.widthMm, page.heightMm] });
  const toPayload = typeof payloadForCode === "function" ? payloadForCode : (code) => code;
  const pages = Math.max(1, Math.ceil(codes.length / box.perPage));

  for (let i = 0; i < codes.length; i++) {
    if (i > 0 && i % box.perPage === 0) doc.addPage([page.widthMm, page.heightMm]);
    const pageIndex = i % box.perPage;
    const col = pageIndex % layout.cols;
    const row = Math.floor(pageIndex / layout.cols);
    const x = page.marginMm + col * box.cellW + box.cellW / 2;
    const topPad = Math.max(2, (box.cellH - box.qrSize - layout.labelGap - 5) / 2);
    const y = page.marginMm + row * box.cellH + topPad;
    const code = codes[i];
    const dataUrl = await QRCode.toDataURL(toPayload(code), { margin: 0, width: 200, errorCorrectionLevel: "M" });
    doc.addImage(dataUrl, "PNG", x - box.qrSize / 2, y, box.qrSize, box.qrSize);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(layout.fontSize);
    doc.setTextColor(20);
    doc.text(code, x, y + box.qrSize + layout.labelGap, { align: "center" });
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    if (page.cropMarks) drawCropMarks(doc, page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(
      `QR stickers — ${prefix} · ${layout.qrMm} mm · ${page.label} · sheet ${p}/${pages}`,
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

function renderSheetPng(codes, layout, { payloadForCode, sheetIndex = 0 }) {
  const box = layoutBox(layout);
  const page = layout.sheet;
  const width = Math.round((page.widthMm / 25.4) * PNG_DPI);
  const height = Math.round((page.heightMm / 25.4) * PNG_DPI);
  const pxPerMm = PNG_DPI / 25.4;
  const rgb = Buffer.alloc(width * height * 3, 255);
  const toPayload = typeof payloadForCode === "function" ? payloadForCode : (code) => code;
  const start = sheetIndex * box.perPage;
  const slice = codes.slice(start, start + box.perPage);

  for (let i = 0; i < slice.length; i++) {
    const col = i % layout.cols;
    const row = Math.floor(i / layout.cols);
    const cellWpx = box.cellW * pxPerMm;
    const cellHpx = box.cellH * pxPerMm;
    const qrPx = box.qrSize * pxPerMm;
    const x = (page.marginMm + col * box.cellW) * pxPerMm + (cellWpx - qrPx) / 2;
    const topPad = Math.max(4, (cellHpx - qrPx - layout.labelGap * pxPerMm - 14) / 2);
    const y = (page.marginMm + row * box.cellH) * pxPerMm + topPad;
    blitQrMatrix(rgb, width, height, x, y, qrPx, toPayload(slice[i]));
  }

  return encodePngRgb(width, height, rgb);
}

export async function buildQrBatchImages(codes, { prefix = "GMP", size = "medium", sheet = "press12x18", payloadForCode } = {}) {
  const layout = resolveStickerSize(size, sheet);
  const perPage = layout.perPage;
  const totalSheets = Math.max(1, Math.ceil(codes.length / perPage));
  const sheets = Math.min(totalSheets, PNG_SHEET_CAP);
  const files = [];
  for (let i = 0; i < sheets; i++) {
    const png = renderSheetPng(codes, layout, { payloadForCode, sheetIndex: i, prefix });
    files.push({
      name: `qr-${layout.sheet.id}-${layout.id}-sheet-${String(i + 1).padStart(2, "0")}.png`,
      data: png,
    });
  }
  if (files.length === 1) {
    return { buffer: files[0].data, contentType: "image/png", filename: files[0].name, sheets, totalSheets };
  }
  return {
    buffer: zipStore(files),
    contentType: "application/zip",
    filename: `qr-${layout.sheet.id}-${layout.id}-sheets.zip`,
    sheets,
    totalSheets,
  };
}
