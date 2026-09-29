import { jsPDF } from "jspdf";
import QRCode from "qrcode";

const COLS = 3;
const ROWS = 8;
const PER_PAGE = COLS * ROWS;

export async function buildQrBatchPdf(codes, { prefix = "GMP" } = {}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 8;
  const cellW = (pageW - margin * 2) / COLS;
  const cellH = (pageH - margin * 2) / ROWS;

  for (let i = 0; i < codes.length; i++) {
    if (i > 0 && i % PER_PAGE === 0) doc.addPage();
    const pageIndex = i % PER_PAGE;
    const col = pageIndex % COLS;
    const row = Math.floor(pageIndex / COLS);
    const x = margin + col * cellW + cellW / 2;
    const y = margin + row * cellH + 6;
    const code = codes[i];
    const dataUrl = await QRCode.toDataURL(code, { margin: 0, width: 120 });
    const qrSize = Math.min(cellW - 4, 28);
    doc.addImage(dataUrl, "PNG", x - qrSize / 2, y, qrSize, qrSize);
    doc.setFontSize(8);
    doc.text(code, x, y + qrSize + 4, { align: "center" });
  }

  doc.setFontSize(10);
  doc.text(`QR batch — ${prefix}`, margin, pageH - 5);
  return Buffer.from(doc.output("arraybuffer"));
}
