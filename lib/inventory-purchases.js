import { parseBookDate, todayDateString } from "@/lib/ledger";

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

  return {
    data: {
      supplier: supplier.slice(0, 80),
      purchase_date: purchaseDate,
      notes: String(body.notes ?? "").trim().slice(0, 200) || null,
      lines: parsedLines,
      grand_total: roundMoney(total),
    },
  };
}

export async function createPurchase(db, user, input) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute(
      `INSERT INTO inventory_purchases (supplier, purchase_date, grand_total, notes, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [input.supplier, input.purchase_date, input.grand_total, input.notes, user?.id || null]
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
  return rows;
}
