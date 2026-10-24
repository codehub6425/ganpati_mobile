import { parseBookDate, todayDateString } from "@/lib/ledger";
import {
  derivePaymentStatus,
  ensureSupplierByName,
  purchaseBalanceDue,
} from "@/lib/inventory-suppliers";
import { purchaseBillPublicPath } from "@/lib/purchase-bill-storage";

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

export function validatePurchaseInput(body) {
  const supplier = String(body.supplier ?? "").trim();
  if (!supplier) return { error: "Supplier is required." };
  const purchaseDate = parseBookDate(body.purchase_date) || todayDateString();
  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (!lines.length) return { error: "Add at least one line." };

  const parsedLines = [];
  let total = 0;
  for (const line of lines) {
    const productId = num(line.product_id);
    const qty = Math.floor(num(line.qty));
    const unitCost = num(line.unit_cost);
    if (!Number.isFinite(productId) || productId <= 0) return { error: "Invalid product on a line." };
    if (!Number.isFinite(qty) || qty <= 0) return { error: "Invalid quantity on a line." };
    if (!Number.isFinite(unitCost) || unitCost < 0) return { error: "Invalid unit cost." };
    const lineTotal = roundMoney(unitCost * qty);
    total += lineTotal;
    parsedLines.push({ product_id: productId, qty, unit_cost: unitCost, line_total: lineTotal });
  }

  const dueDate = body.due_date ? parseBookDate(body.due_date) : null;
  const vendorInvoiceNo = String(body.vendor_invoice_no ?? "").trim().slice(0, 40) || null;

  return {
    data: {
      supplier: supplier.slice(0, 80),
      purchase_date: purchaseDate,
      notes: String(body.notes ?? "").trim().slice(0, 200) || null,
      vendor_invoice_no: vendorInvoiceNo,
      due_date: dueDate,
      lines: parsedLines,
      grand_total: roundMoney(total),
    },
  };
}

function formatPurchaseRow(row) {
  if (!row) return row;
  return {
    ...row,
    balance_due: purchaseBalanceDue(row),
    bill_url: row.bill_storage_key ? purchaseBillPublicPath(row.bill_storage_key) : null,
  };
}

export async function createPurchase(db, user, input) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const supplierId = await ensureSupplierByName(conn, input.supplier);
    const paymentStatus = derivePaymentStatus(input.grand_total, 0);
    const [result] = await conn.execute(
      `INSERT INTO inventory_purchases
        (supplier, supplier_id, purchase_date, grand_total, notes, vendor_invoice_no, due_date,
         amount_paid, payment_status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        input.supplier,
        supplierId,
        input.purchase_date,
        input.grand_total,
        input.notes,
        input.vendor_invoice_no,
        input.due_date,
        paymentStatus,
        user?.id || null,
      ]
    );
    const purchaseId = result.insertId;
    for (const line of input.lines) {
      await conn.execute(
        `INSERT INTO inventory_purchase_lines (purchase_id, product_id, qty, unit_cost, line_total)
         VALUES (?, ?, ?, ?, ?)`,
        [purchaseId, line.product_id, line.qty, line.unit_cost, line.line_total]
      );
      const [prows] = await conn.query("SELECT product_type FROM products WHERE id = ?", [
        line.product_id,
      ]);
      if (prows[0]?.product_type !== "serialized") {
        await conn.execute(
          `INSERT INTO stock_movements (product_id, movement_type, qty_delta, unit_cost, note, ref_type, ref_id, created_by)
           VALUES (?, 'purchase', ?, ?, ?, 'inventory_purchase', ?, ?)`,
          [
            line.product_id,
            line.qty,
            line.unit_cost,
            `Purchase #${purchaseId}`,
            purchaseId,
            user?.id || null,
          ]
        );
        await conn.execute("UPDATE products SET qty_on_hand = qty_on_hand + ? WHERE id = ?", [
          line.qty,
          line.product_id,
        ]);
      }
    }
    await conn.commit();
    return { purchaseId };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function listPurchases(db) {
  const [rows] = await db.query(
    `SELECT p.*, u.name AS created_by_name
     FROM inventory_purchases p
     LEFT JOIN users u ON u.id = p.created_by
     ORDER BY p.purchase_date DESC, p.id DESC
     LIMIT 200`
  );
  return rows.map(formatPurchaseRow);
}

export async function getPurchaseById(db, purchaseId) {
  const id = Math.floor(Number(purchaseId));
  if (!id) return null;
  const [headers] = await db.query(
    `SELECT p.*, u.name AS created_by_name, s.phone AS supplier_phone
     FROM inventory_purchases p
     LEFT JOIN users u ON u.id = p.created_by
     LEFT JOIN inventory_suppliers s ON s.id = p.supplier_id
     WHERE p.id = ?
     LIMIT 1`,
    [id]
  );
  const purchase = headers[0];
  if (!purchase) return null;
  const [lines] = await db.query(
    `SELECT l.*, pr.name AS product_name, pr.product_type
     FROM inventory_purchase_lines l
     JOIN products pr ON pr.id = l.product_id
     WHERE l.purchase_id = ?
     ORDER BY l.id ASC`,
    [id]
  );
  const [payments] = await db.query(
    `SELECT pay.*, u.name AS created_by_name
     FROM inventory_supplier_payments pay
     LEFT JOIN users u ON u.id = pay.created_by
     WHERE pay.purchase_id = ?
     ORDER BY pay.paid_at DESC, pay.id DESC`,
    [id]
  );
  return {
    purchase: formatPurchaseRow(purchase),
    lines,
    payments,
  };
}

export async function setPurchaseBillKey(db, purchaseId, storageKey) {
  await db.execute("UPDATE inventory_purchases SET bill_storage_key = ? WHERE id = ?", [
    storageKey,
    purchaseId,
  ]);
}
