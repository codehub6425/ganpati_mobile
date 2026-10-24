import { adminBookDateIso } from "@/lib/format";
import {
  applyStockMovement,
  PAYMENT_METHODS,
} from "@/lib/inventory.js";
import { derivePaymentStatus } from "@/lib/inventory-suppliers.js";
import {
  canEditDayBook,
  parseBookDate,
  todayDateString,
} from "@/lib/ledger";
import { formatInvoiceNo } from "@/lib/sale-bill";
import { ensureCustomerForLedger } from "@/lib/users";
import { computeWarrantyUntil } from "@/lib/warranty";
import { normalizeQrCode } from "@/lib/qr-code";
import { resolveDueDateFromPreset } from "@/lib/customer-dues-shared.js";

export { resolveDueDateFromPreset } from "@/lib/customer-dues-shared.js";

export const CUSTOMER_DUE_TYPES = ["credit_sale", "advance_order"];
export const CUSTOMER_DUE_STATUSES = ["open", "partial", "settled", "cancelled"];
export const FULFILLMENT_STATUSES = ["pending", "ready", "delivered", "cancelled"];
export const SALE_PAYMENT_MODES = ["full", "partial", "later", "advance"];
export const DUE_DATE_PRESETS = ["in_7_days", "in_15_days", "next_month_7th", "custom"];

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

export function customerDueBalance(billTotal, amountReceived) {
  const total = roundMoney(Number(billTotal) || 0);
  const paid = roundMoney(Number(amountReceived) || 0);
  return roundMoney(Math.max(0, total - paid));
}

export function deriveCustomerDueStatus(billTotal, amountReceived) {
  const balance = customerDueBalance(billTotal, amountReceived);
  if (balance <= 0.009) return "settled";
  const paid = roundMoney(Number(amountReceived) || 0);
  if (paid > 0) return "partial";
  return "open";
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

async function syncSerializedQtyConn(conn, productId) {
  const pid = Number(productId);
  if (!pid) return;
  const [[row]] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM qr_units WHERE product_id = ? AND status = 'in_stock'`,
    [pid]
  );
  await conn.execute(
    "UPDATE products SET qty_on_hand = ? WHERE id = ? AND product_type = 'serialized'",
    [Number(row?.cnt || 0), pid]
  );
}

export async function getActiveReservedQtyConn(conn, productId) {
  const [[row]] = await conn.query(
    `SELECT COALESCE(SUM(qty), 0) AS reserved
     FROM stock_reservations
     WHERE product_id = ? AND status = 'active'`,
    [productId]
  );
  return Number(row?.reserved) || 0;
}

export async function getAvailableQtyConn(conn, productId) {
  const [rows] = await conn.query(
    "SELECT qty_on_hand, product_type FROM products WHERE id = ? LIMIT 1",
    [productId]
  );
  const p = rows[0];
  if (!p) return 0;
  const onHand = Number(p.qty_on_hand) || 0;
  const reserved = await getActiveReservedQtyConn(conn, productId);
  return Math.max(0, onHand - reserved);
}

function formatDueRow(row) {
  return {
    id: row.id,
    due_type: row.due_type,
    customer_phone: row.customer_phone,
    customer_name: row.customer_name,
    bill_total: roundMoney(Number(row.bill_total)),
    amount_received: roundMoney(Number(row.amount_received)),
    balance_due: roundMoney(Number(row.balance_due)),
    due_date: adminBookDateIso(row.due_date),
    due_notes: row.due_notes || null,
    status: row.status,
    fulfillment_status: row.fulfillment_status || null,
    customer_photo_key: row.customer_photo_key || null,
    product_photo_key: row.product_photo_key || null,
    invoice_no: row.invoice_no || null,
    book_date: adminBookDateIso(row.book_date),
    inventory_sale_id: row.inventory_sale_id || null,
    ledger_entry_id: row.ledger_entry_id || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getTotalCustomerDue(db) {
  const [[row]] = await db.query(
    `SELECT COALESCE(SUM(balance_due), 0) AS total
     FROM customer_dues
     WHERE status IN ('open', 'partial') AND balance_due > 0`
  );
  return roundMoney(Number(row?.total) || 0);
}

export async function listCustomerDues(db, { status, overdue } = {}) {
  let sql = `SELECT * FROM customer_dues WHERE 1=1`;
  const params = [];
  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  } else {
    sql += ` AND status IN ('open', 'partial')`;
  }
  if (overdue) {
    sql += ` AND due_date IS NOT NULL AND due_date < CURDATE() AND balance_due > 0`;
  }
  sql += ` ORDER BY due_date IS NULL, due_date ASC, id DESC LIMIT 200`;
  const [rows] = await db.query(sql, params);
  return rows.map(formatDueRow);
}

export async function getCustomerDueDetail(db, dueId) {
  const [rows] = await db.query("SELECT * FROM customer_dues WHERE id = ? LIMIT 1", [dueId]);
  const due = rows[0];
  if (!due) return null;
  const [lines] = await db.query(
    "SELECT * FROM customer_due_lines WHERE customer_due_id = ? ORDER BY sort_order, id",
    [dueId]
  );
  const [payments] = await db.query(
    `SELECT p.*, u.name AS created_by_name
     FROM customer_due_payments p
     LEFT JOIN users u ON u.id = p.created_by
     WHERE p.customer_due_id = ?
     ORDER BY p.paid_at DESC, p.id DESC`,
    [dueId]
  );
  const [reservations] = await db.query(
    `SELECT r.*, pr.name AS product_name
     FROM stock_reservations r
     LEFT JOIN products pr ON pr.id = r.product_id
     WHERE r.customer_due_id = ?`,
    [dueId]
  );
  return {
    due: formatDueRow(due),
    lines: lines.map((l) => ({
      id: l.id,
      description: l.description,
      product_id: l.product_id,
      qty: l.qty,
      line_total: roundMoney(Number(l.line_total)),
      qr_code: l.qr_code || null,
    })),
    payments: payments.map((p) => ({
      id: p.id,
      amount: roundMoney(Number(p.amount)),
      paid_at: adminBookDateIso(p.paid_at),
      payment_method: p.payment_method,
      notes: p.notes,
      ledger_entry_id: p.ledger_entry_id,
      created_by_name: p.created_by_name,
    })),
    reservations: reservations.map((r) => ({
      id: r.id,
      product_id: r.product_id,
      product_name: r.product_name,
      qty: r.qty,
      status: r.status,
    })),
  };
}

function validateCreateInput(body) {
  const dueType =
    body.due_type === "advance_order" || body.payment_mode === "advance" ?
      "advance_order"
    : "credit_sale";
  const bookDate = parseBookDate(body.book_date || body.date) || todayDateString();
  const phone = String(body.customer_phone || "").replace(/\D/g, "").slice(-10);
  const name = String(body.customer_name || "").trim().slice(0, 80);
  const billTotal = roundMoney(num(body.bill_total));
  let amountReceived = roundMoney(num(body.amount_received));
  if (!Number.isFinite(billTotal) || billTotal < 0) {
    return { error: "Enter a valid bill total." };
  }
  const paymentMode = String(body.payment_mode || "partial").trim();
  if (paymentMode === "later") amountReceived = 0;
  if (paymentMode === "full") amountReceived = billTotal;
  if (!Number.isFinite(amountReceived) || amountReceived < 0) {
    return { error: "Enter a valid amount received today." };
  }
  if (amountReceived > billTotal + 0.01) {
    return { error: "Received amount cannot exceed bill total." };
  }
  const balance = customerDueBalance(billTotal, amountReceived);
  if (balance > 0.009 && phone.length !== 10) {
    return { error: "Customer mobile is required for due / partial sales." };
  }
  if (balance > 0.009 && !name) {
    return { error: "Customer name is required for due / partial sales." };
  }
  if (dueType === "advance_order" && phone.length !== 10) {
    return { error: "Customer mobile is required for advance orders." };
  }
  if (dueType === "advance_order" && !name) {
    return { error: "Customer name is required for advance orders." };
  }

  let dueDate = null;
  if (balance > 0.009) {
    dueDate = resolveDueDateFromPreset(
      body.due_preset,
      bookDate,
      body.due_date || body.custom_due_date
    );
    if (!dueDate) {
      return { error: "Select when the balance is due." };
    }
  } else if (body.due_preset || body.due_date) {
    dueDate = resolveDueDateFromPreset(
      body.due_preset || "custom",
      bookDate,
      body.due_date || body.custom_due_date
    );
  }

  const paymentMethod = String(body.payment_method || "cash").trim().toLowerCase();
  if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) {
    return { error: "Invalid payment method." };
  }

  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (!lines.length) {
    return { error: "Add at least one line item." };
  }
  const parsedLines = [];
  for (const row of lines) {
    const description = String(row.description || "").trim().slice(0, 200);
    const lineTotal = roundMoney(num(row.line_total ?? row.amount));
    const qty = Math.max(1, Math.floor(num(row.qty) || 1));
    const productId = row.product_id ? Math.floor(Number(row.product_id)) : null;
    const qrCode = row.qr_code ? normalizeQrCode(row.qr_code) : "";
    if (!description || !Number.isFinite(lineTotal) || lineTotal < 0) {
      return { error: "Each line needs a name and amount." };
    }
    parsedLines.push({
      description,
      line_total: lineTotal,
      qty,
      product_id: productId,
      qr_code: qrCode,
    });
  }

  const ledgerCategory = body.ledger_category === "repair" ? "repair" : "accessory";
  return {
    data: {
      due_type: dueType,
      book_date: bookDate,
      customer_phone: phone.length === 10 ? phone : null,
      customer_name: name || null,
      bill_total: billTotal,
      amount_received: amountReceived,
      balance_due: balance,
      due_date: dueDate,
      due_notes: String(body.due_notes || "").trim().slice(0, 200) || null,
      payment_method: paymentMethod || "cash",
      lines: parsedLines,
      ledger_category: ledgerCategory,
      device_brand: String(body.device_brand || "").trim().slice(0, 40) || null,
      repair_description: String(body.repair_description || body.description || "").trim().slice(0, 200) || null,
      warranty_months: body.warranty_months != null && body.warranty_months !== "" ?
        Math.floor(Number(body.warranty_months))
      : null,
      serial_number: String(body.serial_number || "").trim().slice(0, 80) || null,
      made_in_date: String(body.made_in_date || "").trim().slice(0, 10) || null,
    },
  };
}

async function fulfillCreditLineStock(conn, dueId, line, userId) {
  if (!line.product_id) return;
  const [prows] = await conn.query(
    "SELECT * FROM products WHERE id = ? FOR UPDATE",
    [line.product_id]
  );
  const product = prows[0];
  if (!product) throw new Error(`Product not found for ${line.description}.`);

  if (line.qr_code && product.product_type === "serialized") {
    const [urows] = await conn.query("SELECT * FROM qr_units WHERE code = ? FOR UPDATE", [
      line.qr_code,
    ]);
    const qu = urows[0];
    if (!qu || qu.status !== "in_stock" || qu.product_id !== product.id) {
      throw new Error(`QR ${line.qr_code} is not available.`);
    }
    await conn.execute(
      `UPDATE qr_units SET status = 'sold', sold_at = NOW(), sale_line_id = NULL, notes = ?
       WHERE id = ?`,
      [`Customer due #${dueId}`, qu.id]
    );
    await syncSerializedQtyConn(conn, product.id);
    await conn.execute(
      `INSERT INTO stock_movements
        (product_id, movement_type, qty_delta, unit_cost, note, ref_type, ref_id, created_by)
       VALUES (?, 'sale', -1, ?, ?, 'customer_due', ?, ?)`,
      [
        product.id,
        Number(product.purchase_price) || 0,
        `Due sale QR ${line.qr_code}`,
        dueId,
        userId,
      ]
    );
    return;
  }

  if (product.product_type === "serialized") {
    throw new Error(`${product.name} needs a QR scan before handover.`);
  }

  const available = await getAvailableQtyConn(conn, product.id);
  if (available < line.qty) {
    throw new Error(`Not enough stock for ${product.name}.`);
  }
  await applyStockMovement(conn, {
    productId: product.id,
    movementType: "sale",
    qtyDelta: -line.qty,
    unitCost: Number(product.purchase_price) || 0,
    note: `Customer due #${dueId}`,
    refType: "customer_due",
    refId: dueId,
    createdBy: userId,
  });
}

async function reserveLineStock(conn, dueId, line) {
  if (!line.product_id) return;
  const [prows] = await conn.query(
    "SELECT id, name, product_type FROM products WHERE id = ? FOR UPDATE",
    [line.product_id]
  );
  const product = prows[0];
  if (!product) throw new Error(`Product not found for ${line.description}.`);
  if (product.product_type === "serialized" && !line.qr_code) {
    throw new Error(`${product.name}: scan QR or use credit sale when handing over now.`);
  }
  const available = await getAvailableQtyConn(conn, product.id);
  if (available < line.qty) {
    throw new Error(`Not enough available stock to reserve ${product.name}.`);
  }
  await conn.execute(
    `INSERT INTO stock_reservations (product_id, qty, customer_due_id, status)
     VALUES (?, ?, ?, 'active')`,
    [product.id, line.qty, dueId]
  );
}

export async function createCustomerDueSale(db, user, body) {
  const parsed = validateCreateInput(body);
  if (parsed.error) return { error: parsed.error };
  const input = parsed.data;

  if (!canEditDayBook(user, input.book_date)) {
    return { error: "You cannot record sales for this date." };
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    if (input.customer_phone) {
      const ensured = await ensureCustomerForLedger(conn, {
        phone: input.customer_phone,
        name: input.customer_name || "",
      });
      if (ensured.error) {
        await conn.rollback();
        return { error: ensured.error };
      }
    }

    const status = deriveCustomerDueStatus(input.bill_total, input.amount_received);
    const fulfillment =
      input.due_type === "advance_order" ? "pending" : null;

    const [dueResult] = await conn.execute(
      `INSERT INTO customer_dues
        (due_type, customer_phone, customer_name, bill_total, amount_received, balance_due,
         due_date, due_notes, status, fulfillment_status, book_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.due_type,
        input.customer_phone,
        input.customer_name || "Customer",
        input.bill_total,
        input.amount_received,
        input.balance_due,
        input.due_date,
        input.due_notes,
        status,
        fulfillment,
        input.book_date,
        user?.id || null,
      ]
    );
    const dueId = dueResult.insertId;

    let sort = 0;
    for (const line of input.lines) {
      await conn.execute(
        `INSERT INTO customer_due_lines
          (customer_due_id, description, product_id, qty, line_total, qr_code, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          dueId,
          line.description,
          line.product_id,
          line.qty,
          line.line_total,
          line.qr_code || null,
          sort++,
        ]
      );
      if (input.due_type === "credit_sale") {
        await fulfillCreditLineStock(conn, dueId, line, user?.id || null);
      } else {
        await reserveLineStock(conn, dueId, line);
      }
    }

    const book = await ensureDayBookConn(conn, input.book_date, user?.id || null);
    const desc =
      input.lines.length === 1 ?
        input.lines[0].description
      : `${input.lines[0].description}${input.lines.length > 1 ? ` +${input.lines.length - 1} more` : ""}`;

    const ledgerDescription =
      input.ledger_category === "repair" ?
        input.repair_description || desc
      : desc;

    const warrantyUntil =
      input.warranty_months ?
        computeWarrantyUntil(input.book_date, input.warranty_months)
      : null;

    const cashAmount = input.amount_received;
    const billTotal = input.bill_total > cashAmount + 0.009 ? input.bill_total : null;

    const [ledgerResult] = await conn.execute(
      `INSERT INTO ledger_entries
        (day_book_id, category, amount, bill_total, description, payment_method, customer_phone,
         device_brand, warranty_months, warranty_until, serial_number, made_in_date, customer_due_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        book.id,
        input.ledger_category,
        cashAmount,
        billTotal,
        ledgerDescription,
        input.payment_method,
        input.customer_phone,
        input.ledger_category === "repair" ? input.device_brand : null,
        input.warranty_months,
        warrantyUntil,
        input.serial_number,
        input.made_in_date || null,
        dueId,
        user?.id || null,
      ]
    );
    const ledgerEntryId = ledgerResult.insertId;
    const invoiceNo = formatInvoiceNo(ledgerEntryId);
    await conn.execute("UPDATE ledger_entries SET invoice_no = ? WHERE id = ?", [
      invoiceNo,
      ledgerEntryId,
    ]);
    await conn.execute(
      "UPDATE customer_dues SET ledger_entry_id = ?, invoice_no = ? WHERE id = ?",
      [ledgerEntryId, invoiceNo, dueId]
    );

    await conn.commit();
    const detail = await getCustomerDueDetail(db, dueId);
    return { due: detail, ledger_entry_id: ledgerEntryId, invoice_no: invoiceNo };
  } catch (error) {
    await conn.rollback();
    return { error: error.message || "Could not save customer due." };
  } finally {
    conn.release();
  }
}

export async function recordCustomerDuePayment(db, user, dueId, body) {
  const id = Math.floor(Number(dueId));
  if (!id) return { error: "Invalid due id." };
  const amount = roundMoney(num(body.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid payment amount." };
  }
  const paidAt = parseBookDate(body.paid_at) || todayDateString();
  if (!canEditDayBook(user, paidAt)) {
    return { error: "You cannot record payments for this date." };
  }
  const paymentMethod = String(body.payment_method || "cash").trim().toLowerCase();
  if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) {
    return { error: "Invalid payment method." };
  }
  const notes = String(body.notes || "").trim().slice(0, 200) || null;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query("SELECT * FROM customer_dues WHERE id = ? FOR UPDATE", [id]);
    const due = rows[0];
    if (!due) {
      await conn.rollback();
      return { error: "Customer due not found." };
    }
    if (due.status === "cancelled") {
      await conn.rollback();
      return { error: "This due is cancelled." };
    }
    const balance = roundMoney(Number(due.balance_due));
    if (amount > balance + 0.01) {
      await conn.rollback();
      return { error: `Payment exceeds balance due (₹${balance}).` };
    }

    const book = await ensureDayBookConn(conn, paidAt, user?.id || null);
    const description = `Customer due: ${due.customer_name} (${due.customer_phone})`;
    const [ledgerResult] = await conn.execute(
      `INSERT INTO ledger_entries
        (day_book_id, category, amount, description, payment_flow, payment_method, customer_phone, created_by)
       VALUES (?, 'payment', ?, ?, 'taken', ?, ?, ?)`,
      [
        book.id,
        amount,
        description,
        paymentMethod || "cash",
        due.customer_phone,
        user?.id || null,
      ]
    );

    await conn.execute(
      `INSERT INTO customer_due_payments
        (customer_due_id, amount, paid_at, payment_method, notes, ledger_entry_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, amount, paidAt, paymentMethod || "cash", notes, ledgerResult.insertId, user?.id || null]
    );

    const newReceived = roundMoney(Number(due.amount_received) + amount);
    const newBalance = customerDueBalance(due.bill_total, newReceived);
    const newStatus = deriveCustomerDueStatus(due.bill_total, newReceived);
    await conn.execute(
      "UPDATE customer_dues SET amount_received = ?, balance_due = ?, status = ? WHERE id = ?",
      [newReceived, newBalance, newStatus, id]
    );

    await conn.commit();
    return { payment_id: ledgerResult.insertId, due: (await getCustomerDueDetail(db, id)).due };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function deliverAdvanceOrder(db, user, dueId) {
  const id = Math.floor(Number(dueId));
  if (!id) return { error: "Invalid due id." };

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query("SELECT * FROM customer_dues WHERE id = ? FOR UPDATE", [id]);
    const due = rows[0];
    if (!due) {
      await conn.rollback();
      return { error: "Customer due not found." };
    }
    if (due.due_type !== "advance_order") {
      await conn.rollback();
      return { error: "Only advance orders can be marked delivered." };
    }
    if (due.fulfillment_status === "delivered") {
      await conn.rollback();
      return { error: "Already delivered." };
    }

    const [lines] = await conn.query(
      "SELECT * FROM customer_due_lines WHERE customer_due_id = ? ORDER BY sort_order, id",
      [id]
    );
    const [reservations] = await conn.query(
      "SELECT * FROM stock_reservations WHERE customer_due_id = ? AND status = 'active'",
      [id]
    );

    for (const line of lines) {
      if (!line.product_id) continue;
      await fulfillCreditLineStock(
        conn,
        id,
        {
          product_id: line.product_id,
          qty: line.qty,
          qr_code: line.qr_code,
          description: line.description,
        },
        user?.id || null
      );
    }

    for (const res of reservations) {
      await conn.execute("UPDATE stock_reservations SET status = 'consumed' WHERE id = ?", [
        res.id,
      ]);
    }

    await conn.execute(
      "UPDATE customer_dues SET fulfillment_status = 'delivered' WHERE id = ?",
      [id]
    );

    await conn.commit();
    return { due: (await getCustomerDueDetail(db, id)).due };
  } catch (error) {
    await conn.rollback();
    return { error: error.message || "Could not complete delivery." };
  } finally {
    conn.release();
  }
}

export async function patchCustomerDue(db, dueId, body) {
  const id = Math.floor(Number(dueId));
  if (!id) return { error: "Invalid due id." };
  const updates = [];
  const params = [];
  if (body.due_notes !== undefined) {
    updates.push("due_notes = ?");
    params.push(String(body.due_notes || "").trim().slice(0, 200) || null);
  }
  if (body.due_date !== undefined) {
    const d = String(body.due_date || "").trim().slice(0, 10);
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return { error: "Invalid due date." };
    updates.push("due_date = ?");
    params.push(d || null);
  }
  if (!updates.length) return { error: "Nothing to update." };
  params.push(id);
  await db.execute(`UPDATE customer_dues SET ${updates.join(", ")} WHERE id = ?`, params);
  return { due: (await getCustomerDueDetail(db, id)).due };
}
