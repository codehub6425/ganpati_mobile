import { formatProductRow, createInventorySale } from "@/lib/inventory";
import { todayDateString } from "@/lib/ledger";

export const QR_UNIT_STATUSES = ["unassigned", "in_stock", "sold", "returned", "void"];
export const PRODUCT_TYPES = ["quantity", "serialized"];
export const SALE_MODES = ["cash", "finance"];

const PAD = 6;

export function formatQrCode(prefix, num) {
  const p = String(prefix || "GMP")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
  const n = Math.max(1, Math.floor(Number(num) || 0));
  return `${p}-${String(n).padStart(PAD, "0")}`;
}

export function normalizeQrCode(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export async function getNextBatchStart(db, prefix) {
  const p = String(prefix || "GMP").trim().toUpperCase();
  const [[row]] = await db.query(
    "SELECT COALESCE(MAX(end_num), 0) AS max_end FROM qr_batches WHERE prefix = ?",
    [p]
  );
  return Number(row?.max_end || 0) + 1;
}

export async function createQrBatch(db, userId, { prefix = "GMP", count = 100 }) {
  const batchCount = Math.min(5000, Math.max(1, Math.floor(Number(count) || 0)));
  const startNum = await getNextBatchStart(db, prefix);
  const endNum = startNum + batchCount - 1;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [batchResult] = await conn.execute(
      `INSERT INTO qr_batches (prefix, start_num, end_num, count, created_by) VALUES (?, ?, ?, ?, ?)`,
      [prefix.toUpperCase(), startNum, endNum, batchCount, userId || null]
    );
    const batchId = batchResult.insertId;
    for (let n = startNum; n <= endNum; n++) {
      const code = formatQrCode(prefix, n);
      await conn.execute(`INSERT INTO qr_units (code, batch_id, status) VALUES (?, ?, 'unassigned')`, [
        code,
        batchId,
      ]);
    }
    await conn.commit();
    return { batchId, prefix: prefix.toUpperCase(), startNum, endNum, count: batchCount };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function listQrBatches(db) {
  const [rows] = await db.query(
    `SELECT b.*, u.name AS created_by_name,
       (SELECT COUNT(*) FROM qr_units q WHERE q.batch_id = b.id AND q.status = 'unassigned') AS unassigned_count,
       (SELECT COUNT(*) FROM qr_units q WHERE q.batch_id = b.id AND q.status = 'in_stock') AS in_stock_count,
       (SELECT COUNT(*) FROM qr_units q WHERE q.batch_id = b.id AND q.status = 'sold') AS sold_count
     FROM qr_batches b
     LEFT JOIN users u ON u.id = b.created_by
     ORDER BY b.id DESC
     LIMIT 100`
  );
  return rows;
}

export async function listQrUnits(db, opts = {}) {
  const where = [];
  const args = [];
  const status = String(opts.status || "").trim();
  const productId = opts.product_id ? Number(opts.product_id) : null;
  const search = normalizeQrCode(opts.search);

  if (status && QR_UNIT_STATUSES.includes(status)) {
    where.push("q.status = ?");
    args.push(status);
  }
  if (productId) {
    where.push("q.product_id = ?");
    args.push(productId);
  }
  if (search) {
    where.push("q.code LIKE ?");
    args.push(`%${search}%`);
  }

  const limit = Math.min(500, Math.max(1, Number(opts.limit) || 100));
  const offset = Math.max(0, Number(opts.offset) || 0);
  const sql = `
    SELECT q.*, p.name AS product_name, p.brand AS product_brand, p.sku AS product_sku
    FROM qr_units q
    LEFT JOIN products p ON p.id = q.product_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY q.id DESC
    LIMIT ? OFFSET ?`;
  args.push(limit, offset);
  const [rows] = await db.query(sql, args);

  const countSql = `SELECT COUNT(*) AS total FROM qr_units q ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`;
  const countArgs = args.slice(0, -2);
  const [[countRow]] = await db.query(countSql, countArgs);

  return {
    units: rows.map(formatQrUnitRow),
    total: Number(countRow?.total || 0),
    limit,
    offset,
  };
}

export function formatQrUnitRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    batch_id: row.batch_id,
    status: row.status,
    product_id: row.product_id,
    product_name: row.product_name || null,
    product_brand: row.product_brand || null,
    product_sku: row.product_sku || null,
    linked_at: row.linked_at,
    warranty_months: row.warranty_months != null ? Number(row.warranty_months) : null,
    warranty_expires_at: row.warranty_expires_at,
    sold_at: row.sold_at,
    notes: row.notes,
    purchase_line_id: row.purchase_line_id,
    sale_line_id: row.sale_line_id,
  };
}

export async function loadQrUnitByCode(db, rawCode, { forUpdate = false } = {}) {
  const code = normalizeQrCode(rawCode);
  if (!code) return null;
  const lock = forUpdate ? " FOR UPDATE" : "";
  const [rows] = await db.query(
    `SELECT q.*, p.name AS product_name, p.brand AS product_brand, p.sku, p.selling_price, p.mrp,
            p.purchase_price, p.image_url, p.category_id, p.product_type, p.status AS product_status,
            c.name AS category_name
     FROM qr_units q
     LEFT JOIN products p ON p.id = q.product_id
     LEFT JOIN product_categories c ON c.id = p.category_id
     WHERE q.code = ?
     LIMIT 1${lock}`,
    [code]
  );
  return rows[0] || null;
}

export async function syncSerializedQty(conn, productId) {
  const pid = Number(productId);
  if (!pid) return;
  const [[row]] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM qr_units WHERE product_id = ? AND status = 'in_stock'`,
    [pid]
  );
  const qty = Number(row?.cnt || 0);
  await conn.execute("UPDATE products SET qty_on_hand = ? WHERE id = ? AND product_type = 'serialized'", [
    qty,
    pid,
  ]);
  return qty;
}

function addMonths(dateIso, months) {
  const d = new Date(dateIso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export async function linkQrUnit(db, user, input) {
  const code = normalizeQrCode(input.code);
  const productId = Number(input.product_id);
  if (!code) return { error: "QR code is required." };
  if (!productId) return { error: "Select a product." };

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const unit = await loadQrUnitByCode(conn, code, { forUpdate: true });
    if (!unit) {
      await conn.rollback();
      return { error: "QR code not found." };
    }
    if (unit.status !== "unassigned") {
      await conn.rollback();
      return { error: `This QR is already ${unit.status.replace("_", " ")}.` };
    }

    const [prows] = await conn.query("SELECT * FROM products WHERE id = ? FOR UPDATE", [productId]);
    const product = prows[0];
    if (!product) {
      await conn.rollback();
      return { error: "Product not found." };
    }
    if (product.product_type !== "serialized") {
      await conn.rollback();
      return { error: "Link QR only to serialized products. Change product type to serialized first." };
    }

    const purchasePrice = Number(input.purchase_price);
    const sellingPrice = Number(input.selling_price);
    const warrantyMonths = input.warranty_months != null ? Math.floor(Number(input.warranty_months)) : null;
    if (Number.isFinite(purchasePrice) && purchasePrice >= 0) {
      await conn.execute("UPDATE products SET purchase_price = ? WHERE id = ?", [purchasePrice, productId]);
    }
    if (Number.isFinite(sellingPrice) && sellingPrice >= 0) {
      await conn.execute("UPDATE products SET selling_price = ? WHERE id = ?", [sellingPrice, productId]);
    }
    if (input.supplier) {
      await conn.execute("UPDATE products SET supplier = ? WHERE id = ?", [
        String(input.supplier).slice(0, 80),
        productId,
      ]);
    }

    let purchaseLineId = null;
    if (input.purchase_id) {
      const unitCost = Number.isFinite(purchasePrice) ? purchasePrice : Number(product.purchase_price) || 0;
      const [lineResult] = await conn.execute(
        `INSERT INTO inventory_purchase_lines (purchase_id, product_id, qty, unit_cost, line_total)
         VALUES (?, ?, 1, ?, ?)`,
        [Number(input.purchase_id), productId, unitCost, unitCost]
      );
      purchaseLineId = lineResult.insertId;
    }

    const linkedAt = new Date();
    const warrantyExpires =
      warrantyMonths && warrantyMonths > 0 ? addMonths(linkedAt.toISOString(), warrantyMonths) : null;

    await conn.execute(
      `UPDATE qr_units SET status = 'in_stock', product_id = ?, linked_at = ?, purchase_line_id = ?,
       warranty_months = ?, warranty_expires_at = ?, notes = ?
       WHERE id = ?`,
      [
        productId,
        linkedAt,
        purchaseLineId,
        warrantyMonths,
        warrantyExpires,
        input.note ? String(input.note).slice(0, 200) : null,
        unit.id,
      ]
    );

    await conn.execute(
      `INSERT INTO stock_movements
        (product_id, movement_type, qty_delta, unit_cost, note, ref_type, ref_id, created_by)
       VALUES (?, 'purchase', 1, ?, ?, 'qr_unit', ?, ?)`,
      [
        productId,
        Number.isFinite(purchasePrice) ? purchasePrice : Number(product.purchase_price) || null,
        `QR linked: ${code}`,
        unit.id,
        user?.id || null,
      ]
    );

    await syncSerializedQty(conn, productId);
    await conn.commit();

    const updated = await loadQrUnitByCode(db, code);
    const [productRows] = await db.query(
      `SELECT p.*, c.name AS category_name FROM products p
       JOIN product_categories c ON c.id = p.category_id WHERE p.id = ?`,
      [productId]
    );
    return {
      unit: formatQrUnitRow(updated),
      product: productRows[0] ? formatProductRow(productRows[0]) : null,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function lookupQrCode(db, rawCode) {
  const row = await loadQrUnitByCode(db, rawCode);
  if (!row) return { error: "QR code not found." };

  const product =
    row.product_id ?
      formatProductRow({
        ...row,
        id: row.product_id,
        name: row.product_name,
        status: row.product_status,
      })
    : null;

  const actions = {
    can_link: row.status === "unassigned",
    can_sell: row.status === "in_stock",
    can_return: row.status === "sold",
    can_view: row.status !== "unassigned" && row.product_id,
  };

  return {
    unit: formatQrUnitRow(row),
    product,
    actions,
  };
}

export async function sellQrUnit(db, user, input) {
  const code = normalizeQrCode(input.code);
  if (!code) return { error: "QR code is required." };

  const unit = await loadQrUnitByCode(db, code);
  if (!unit) return { error: "QR code not found." };
  if (unit.status !== "in_stock" || !unit.product_id) {
    return { error: "This unit is not available for sale." };
  }

  const saleMode = SALE_MODES.includes(input.sale_mode) ? input.sale_mode : "cash";
  const result = await createInventorySale(db, user, {
    sale_date: input.sale_date || todayDateString(),
    payment_method: input.payment_method || "cash",
    customer_phone: input.customer_phone,
    customer_name: input.customer_name,
    notes: input.notes,
    cart_discount: 0,
    sale_mode: saleMode,
    finance_down_payment: input.finance_down_payment,
    finance_tenure_months: input.finance_tenure_months,
    finance_notes: input.finance_notes,
    lines: [{ product_id: unit.product_id, qty: 1, line_discount: 0 }],
    qr_codes: [code],
  });

  if (result.error) return result;
  return { sale: result.sale, profit_total: result.profit_total };
}

export async function returnQrUnit(db, user, input) {
  const code = normalizeQrCode(input.code);
  const restock = input.restock !== false;
  if (!code) return { error: "QR code is required." };

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const unit = await loadQrUnitByCode(conn, code, { forUpdate: true });
    if (!unit) {
      await conn.rollback();
      return { error: "QR code not found." };
    }
    if (unit.status !== "sold") {
      await conn.rollback();
      return { error: "Only sold units can be returned." };
    }
    if (!unit.product_id) {
      await conn.rollback();
      return { error: "Unit has no linked product." };
    }

    const nextStatus = restock ? "in_stock" : "void";
    await conn.execute(
      `UPDATE qr_units SET status = ?, sold_at = NULL, sale_line_id = NULL, notes = ?
       WHERE id = ?`,
      [nextStatus, input.note ? String(input.note).slice(0, 200) : "Return processed", unit.id]
    );

    if (restock) {
      await conn.execute(
        `INSERT INTO stock_movements
          (product_id, movement_type, qty_delta, note, ref_type, ref_id, created_by)
         VALUES (?, 'return', 1, ?, 'qr_unit', ?, ?)`,
        [unit.product_id, `Return: ${code}`, unit.id, user?.id || null]
      );
      await syncSerializedQty(conn, unit.product_id);
    }

    await conn.commit();
    const updated = await loadQrUnitByCode(db, code);
    return { unit: formatQrUnitRow(updated) };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function getQrBatchCodes(db, batchId) {
  const [rows] = await db.query(
    "SELECT code FROM qr_units WHERE batch_id = ? ORDER BY id ASC",
    [Number(batchId)]
  );
  return rows.map((r) => r.code);
}

export async function getQrKpiCounts(db) {
  const [[u]] = await db.query(
    `SELECT
       SUM(status = 'unassigned') AS unassigned,
       SUM(status = 'in_stock') AS in_stock,
       SUM(status = 'sold') AS sold
     FROM qr_units`
  );
  return {
    qr_unassigned: Number(u?.unassigned || 0),
    qr_in_stock: Number(u?.in_stock || 0),
    qr_sold: Number(u?.sold || 0),
  };
}
