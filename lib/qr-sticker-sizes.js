export const SHEET_FORMATS = {
  press12x18: {
    id: "press12x18",
    label: "12×18 in — printing press",
    hint: "Landscape press sheet. Give this PDF/PNG to the printer.",
    widthMm: 18 * 25.4,
    heightMm: 12 * 25.4,
    marginMm: 10,
    cropMarks: true,
  },
  a4: {
    id: "a4",
    label: "A4 — shop printer",
    hint: "Print and cut on the shop printer.",
    widthMm: 210,
    heightMm: 297,
    marginMm: 8,
    cropMarks: false,
  },
};

export const STICKER_SIZES = {
  small: {
    id: "small",
    label: "Small (~20 mm)",
    hint: "Cables, earbuds",
    qrMm: 20,
    fontSize: 6.5,
    labelGap: 3,
    a4: { cols: 4, rows: 10 },
    press12x18: { cols: 14, rows: 8 },
  },
  medium: {
    id: "medium",
    label: "Medium (~30 mm)",
    hint: "Chargers, covers — 63 per 12×18 sheet",
    qrMm: 30,
    fontSize: 7.5,
    labelGap: 3.5,
    a4: { cols: 3, rows: 8, qrMm: 28 },
    press12x18: { cols: 9, rows: 7 },
  },
  large: {
    id: "large",
    label: "Large (~40 mm)",
    hint: "Boxes, phones",
    qrMm: 40,
    fontSize: 10,
    labelGap: 5,
    a4: { cols: 2, rows: 5 },
    press12x18: { cols: 7, rows: 5 },
  },
};

export function resolveSheet(sheet) {
  const key = String(sheet || "press12x18")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (key === "a4") return SHEET_FORMATS.a4;
  if (key === "press12x18" || key === "12x18" || key === "press") return SHEET_FORMATS.press12x18;
  return SHEET_FORMATS[key] || SHEET_FORMATS.press12x18;
}

export function resolveStickerSize(size, sheet) {
  const sizeKey = String(size || "medium").trim().toLowerCase();
  const sticker = STICKER_SIZES[sizeKey] || STICKER_SIZES.medium;
  const page = arguments.length < 2 ? SHEET_FORMATS.a4 : resolveSheet(sheet);
  const grid = sticker[page.id] || sticker.a4;
  const qrMm = grid.qrMm || sticker.qrMm;
  return {
    id: sticker.id,
    label: sticker.label,
    hint: sticker.hint,
    fontSize: sticker.fontSize,
    labelGap: sticker.labelGap,
    cols: grid.cols,
    rows: grid.rows,
    qrMm,
    perPage: grid.cols * grid.rows,
    sheet: page,
  };
}

export function stickerSizeIds() {
  return Object.keys(STICKER_SIZES);
}

export function sheetFormatIds() {
  return Object.keys(SHEET_FORMATS);
}

export function layoutHint(size, sheet) {
  const layout = resolveStickerSize(size, sheet || "press12x18");
  return `${layout.qrMm} mm QR · ${layout.perPage} per sheet · ${layout.sheet.label}`;
}
