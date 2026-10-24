import { canEditDayBook, todayDateString } from "@/lib/ledger";

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

export function purchaseBalanceDue(purchase) {
  const total = roundMoney(Number(purchase.grand_total) || 0);
  const paid = roundMoney(Number(purchase.amount_paid) || 0);
  return roundMoney(Math.max(0, total - paid));
}

export function derivePaymentStatus(grandTotal, amountPaid) {
  const total = roundMoney(Number(grandTotal) || 0);
  const paid = roundMoney(Number(amountPaid) || 0);
  if (total <= 0 || paid >= total) return "paid";
  if (paid > 0) return "partial";
  return "due";
}

export async function ensureSupplierByName(conn, name) {
  const trimmed = String(name || "").trim().slice(0, 80);
  if (!trimmed) return null;
  const [existing] = await conn.query(
    "SELECT id FROM inventory_suppliers WHERE name = ? LIMIT 1",
    [trimmed]
  );
  if (existing[0]?.id) return existing[0].id;
  const [result] = await conn.execute(
    "INSERT INTO inventory_suppliers (name) VALUES (?)",
    [trimmed]
  );
  return result.insertId;
}

async function ensureDayBookConn(conn, bookDate, userId) {
  const [rows] = await conn.query("SELECT * FROM day_books WHERE book_date = ? LIMIT 1", [bookDate]);
  if (rows[0]) return rows[0];
  const [result] = await conn.execute(
    "INSERT INTO day_books (book_date, created_by) VALUES (?, ?)",
    [bookDate, userId]
  );
  const [created] = await conn.query("SELECT * FROM day_books WHERE id = ? LIMIT 1", [result.insertId]);
  return created[0];
}

export async function listSuppliersWithBalances(db) {
  const [rows] = await db.query(
    `SELECT s.id, s.name, s.phone, s.notes,
            COALESCE(SUM(GREATEST(p.grand_total - p.amount_paid, 0)), 0) AS total_due,
            COUNT(CASE WHEN p.grand_total > p.amount_paid THEN 1 END) AS open_bills
     FROM inventory_suppliers s
     LEFT JOIN inventory_purchases p ON p.supplier_id = s.id
     GROUP BY s.id, s.name, s.phone, s.notes
     ORDER BY total_due DESC, s.name ASC`
  );
  return rows.map((row) => ({
    ...row,
    total_due: roundMoney(Number(row.total_due) || 0),
    open_bills: Number(row.open_bills) || 0,
  }));
}

export async function getSupplierLedger(db, supplierId) {
  const id = Math.floor(Number(supplierId));
  if (!id) return null;
  const [suppliers] = await db.query("SELECT * FROM inventory_suppliers WHERE id = ? LIMIT 1", [id]);
  const supplier = suppliers[0];
  if (!supplier) return null;

  const [purchases] = await db.query(
    `SELECT p.*, u.name AS created_by_name
     FROM inventory_purchases p
     LEFT JOIN users u ON u.id = p.created_by
     WHERE p.supplier_id = ?
     ORDER BY p.purchase_date DESC, p.id DESC`,
    [id]
  );

  const [payments] = await db.query(
    `SELECT pay.*, u.name AS created_by_name
     FROM inventory_supplier_payments pay
     LEFT JOIN users u ON u.id = pay.created_by
     WHERE pay.supplier_id = ?
     ORDER BY pay.paid_at DESC, pay.id DESC`,
    [id]
  );

  const purchasesFormatted = purchases.map((p) => ({
    ...p,
    balance_due: purchaseBalanceDue(p),
  }));

  const totalDue = roundMoney(
    purchasesFormatted.reduce((sum, p) => sum + purchaseBalanceDue(p), 0)
  );

  return {
    supplier,
    purchases: purchasesFormatted,
    payments,
    total_due: totalDue,
  };
}

export function validateSupplierPaymentInput(body) {
  const supplierId = num(body.supplier_id);
  const purchaseId = body.purchase_id != null && body.purchase_id !== "" ? num(body.purchase_id) : null;
  const amount = num(body.amount);
  const paidAt = String(body.paid_at || "").trim().slice(0, 10) || todayDateString();
  const paymentMethod = String(body.payment_method ?? "").trim().slice(0, 20) || null;
  const notes = String(body.notes ?? "").trim().slice(0, 200) || null;

  if (!Number.isFinite(supplierId) || supplierId <= 0) {
    return { error: "Invalid supplier." };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid payment amount." };
  }

  return {
    data: {
      supplier_id: supplierId,
      purchase_id: Number.isFinite(purchaseId) && purchaseId > 0 ? purchaseId : null,
      amount: roundMoney(amount),
      paid_at: paidAt,
      payment_method: paymentMethod,
      notes,
    },
  };
}

export async function recordSupplierPayment(db, user, input) {
  if (!canEditDayBook(user, input.paid_at)) {
    return { error: "You cannot record payments for this date." };
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [supRows] = await conn.query(
      "SELECT id, name FROM inventory_suppliers WHERE id = ? LIMIT 1",
      [input.supplier_id]
    );
    const supplier = supRows[0];
    if (!supplier) {
      await conn.rollback();
      return { error: "Supplier not found." };
    }

    let purchase = null;
    if (input.purchase_id) {
      const [prows] = await conn.query(
        "SELECT * FROM inventory_purchases WHERE id = ? AND supplier_id = ? LIMIT 1",
        [input.purchase_id, input.supplier_id]
      );
      purchase = prows[0];
      if (!purchase) {
        await conn.rollback();
        return { error: "Purchase not found for this supplier." };
      }
      const due = purchaseBalanceDue(purchase);
      if (input.amount > due + 0.01) {
        await conn.rollback();
        return { error: `Payment exceeds balance due (₹${due}).` };
      }
    }

    const book = await ensureDayBookConn(conn, input.paid_at, user?.id || null);
    const description =
      purchase ?
        `Vendor: ${supplier.name} — Purchase #${purchase.id}`
      : `Vendor: ${supplier.name}`;

    const [ledgerResult] = await conn.execute(
      `INSERT INTO ledger_entries
        (day_book_id, category, amount, description, payment_flow, payment_method, created_by)
       VALUES (?, 'payment', ?, ?, 'given', ?, ?)`,
      [book.id, input.amount, description, input.payment_method, user?.id || null]
    );
    const ledgerEntryId = ledgerResult.insertId;

    const [payResult] = await conn.execute(
      `INSERT INTO inventory_supplier_payments
        (supplier_id, purchase_id, amount, paid_at, payment_method, notes, ledger_entry_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.supplier_id,
        input.purchase_id,
        input.amount,
        input.paid_at,
        input.payment_method,
        input.notes,
        ledgerEntryId,
        user?.id || null,
      ]
    );

    if (purchase) {
      const newPaid = roundMoney(Number(purchase.amount_paid) + input.amount);
      const status = derivePaymentStatus(purchase.grand_total, newPaid);
      await conn.execute(
        "UPDATE inventory_purchases SET amount_paid = ?, payment_status = ? WHERE id = ?",
        [newPaid, status, purchase.id]
      );
    }

    await conn.commit();
    return { paymentId: payResult.insertId, ledger_entry_id: ledgerEntryId };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function getTotalVendorDue(db) {
  try {
    const [[row]] = await db.query(
      `SELECT COALESCE(SUM(GREATEST(grand_total - amount_paid, 0)), 0) AS vendor_due_total
       FROM inventory_purchases`
    );
    return roundMoney(Number(row?.vendor_due_total) || 0);
  } catch {
    return 0;
  }
}

export async function getLastPurchase(db) {
  try {
    const [rows] = await db.query(
      `SELECT id, supplier, purchase_date, grand_total, amount_paid, payment_status
       FROM inventory_purchases
       ORDER BY purchase_date DESC, id DESC
       LIMIT 1`
    );
    const p = rows[0];
    if (!p) return null;
    return {
      ...p,
      balance_due: purchaseBalanceDue(p),
    };
  } catch {
    return null;
  }
}
