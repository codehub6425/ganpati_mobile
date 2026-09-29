import { adminTodayIso } from "@/lib/format";
import { canEditDayBook, parseBookDate, todayDateString } from "@/lib/ledger";
import { ensureCustomerForLedger } from "@/lib/users";

export const PRODUCT_STATUSES = ["active", "inactive"];
export const PRODUCT_TYPES = ["quantity", "serialized"];
export const MOVEMENT_TYPES = ["purchase", "sale", "adjustment", "return"];
export const REQUEST_STATUSES = ["pending", "available", "purchased", "cancelled"];
export const PAYMENT_METHODS = ["cash", "upi", "sbi", "boi", "other"];
export const SALE_MODES = ["cash", "finance"];

function normalizeQrCode(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
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

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function computeProductFlags(product) {
  const qty = Number(product?.qty_on_hand) || 0;
  const min = Number(product?.min_stock_level) || 0;
  const active = product?.status === "active";
  return {
    out_of_stock: active && qty <= 0,
    low_stock: active && qty > 0 && qty <= min,
  };
}

export function formatProductRow(row) {
  const purchase = Number(row.purchase_price) || 0;
  const selling = Number(row.selling_price) || 0;
  const profit = selling - purchase;
  const marginPct = selling > 0 ? roundMoney((profit / selling) * 100) : 0;
  const flags = computeProductFlags(row);
  return {
    id: row.id,
    category_id: row.category_id,
    category_name: row.category_name || null,
    name: row.name,
    brand: row.brand || null,
    sku: row.sku || null,
    purchase_price: purchase,
    mrp: Number(row.mrp) || 0,
    selling_price: selling,
    discount_pct: row.discount_pct != null ? Number(row.discount_pct) : null,
    qty_on_hand: Number(row.qty_on_hand) || 0,
    min_stock_level: Number(row.min_stock_level) || 0,
    supplier: row.supplier || null,
    image_url: row.image_url || null,
    warranty_text: row.warranty_text || null,
    status: row.status || "active",
    product_type: row.product_type || "quantity",
    profit_per_unit: roundMoney(profit),
    margin_pct: marginPct,
    ...flags,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function validateProductInput(body, { partial = false } = {}) {
  const errors = {};
  const name = String(body.name ?? "").trim();
  const categoryId = num(body.category_id);
  if (!partial || body.name !== undefined) {
    if (!name) errors.name = "Product name is required.";
  }
  if (!partial || body.category_id !== undefined) {
    if (!Number.isFinite(categoryId) || categoryId <= 0) errors.category_id = "Select a category.";
  }

  const purchase = num(body.purchase_price);
  const mrp = num(body.mrp);
  const selling = num(body.selling_price);
  if (!partial || body.purchase_price !== undefined) {
    if (!Number.isFinite(purchase) || purchase < 0) errors.purchase_price = "Invalid purchase price.";
  }
  if (!partial || body.mrp !== undefined) {
    if (!Number.isFinite(mrp) || mrp < 0) errors.mrp = "Invalid MRP.";
  }
  if (!partial || body.selling_price !== undefined) {
    if (!Number.isFinite(selling) || selling < 0) errors.selling_price = "Invalid selling price.";
  }

  const minStock = num(body.min_stock_level);
  if (body.min_stock_level !== undefined && (!Number.isFinite(minStock) || minStock < 0)) {
    errors.min_stock_level = "Invalid minimum stock.";
  }

  const status = String(body.status ?? "active").trim();
  if (body.status !== undefined && !PRODUCT_STATUSES.includes(status)) {
    errors.status = "Invalid status.";
  }

  const productType = String(body.product_type ?? "quantity").trim();
  if (body.product_type !== undefined && !PRODUCT_TYPES.includes(productType)) {
    errors.product_type = "Invalid product type.";
  }

  if (Object.keys(errors).length) return { error: Object.values(errors)[0], errors };
  return {
    data: {
      name: name || undefined,
      category_id: Number.isFinite(categoryId) ? categoryId : undefined,
      brand: String(body.brand ?? "").trim().slice(0, 60) || null,
      sku: String(body.sku ?? "").trim().slice(0, 40) || null,
      purchase_price: Number.isFinite(purchase) ? purchase : undefined,
      mrp: Number.isFinite(mrp) ? mrp : undefined,
      selling_price: Number.isFinite(selling) ? selling : undefined,
      discount_pct:
        body.discount_pct === "" || body.discount_pct == null ?
          null
        : num(body.discount_pct),
      min_stock_level: Number.isFinite(minStock) ? minStock : undefined,
      supplier: String(body.supplier ?? "").trim().slice(0, 80) || null,
      image_url: String(body.image_url ?? "").trim().slice(0, 255) || null,
      warranty_text: String(body.warranty_text ?? "").trim().slice(0, 120) || null,
      status: status || undefined,
      product_type: body.product_type !== undefined ? productType : undefined,
    },
  };
}

export async function applyStockMovement(conn, opts) {
  const productId = Number(opts.productId);
  const qtyDelta = Number(opts.qtyDelta);
  const type = String(opts.movementType || "").trim();
  if (!productId || !Number.isFinite(qtyDelta) || qtyDelta === 0) {
    throw new Error("Invalid stock movement.");
  }
  if (!MOVEMENT_TYPES.includes(type)) throw new Error("Invalid movement type.");

  const [rows] = await conn.query("SELECT id, qty_on_hand FROM products WHERE id = ? FOR UPDATE", [
    productId,
  ]);
  const product = rows[0];
  if (!product) throw new Error("Product not found.");

  const nextQty = Number(product.qty_on_hand) + qtyDelta;
  if (nextQty < 0) throw new Error("Insufficient stock.");

  await conn.execute("UPDATE products SET qty_on_hand = ? WHERE id = ?", [nextQty, productId]);
  await conn.execute(
    `INSERT INTO stock_movements
      (product_id, movement_type, qty_delta, unit_cost, note, ref_type, ref_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      productId,
      type,
      qtyDelta,
      opts.unitCost ?? null,
      opts.note ? String(opts.note).slice(0, 200) : null,
      opts.refType ?? null,
      opts.refId ?? null,
      opts.createdBy ?? null,
    ]
  );
  return nextQty;
}

export async function getDashboardKpis(db) {
  const today = todayDateString();
  const [[productStats]] = await db.query(
    `SELECT
       COUNT(*) AS total_products,
       COALESCE(SUM(qty_on_hand), 0) AS total_stock_qty,
       COALESCE(SUM(CASE WHEN status = 'active' AND qty_on_hand <= 0 THEN 1 ELSE 0 END), 0) AS out_of_stock_count,
       COALESCE(SUM(CASE WHEN status = 'active' AND qty_on_hand > 0 AND qty_on_hand <= min_stock_level THEN 1 ELSE 0 END), 0) AS low_stock_count,
       COALESCE(SUM(CASE WHEN status = 'active' THEN qty_on_hand * purchase_price ELSE 0 END), 0) AS stock_value,
       COALESCE(SUM(CASE WHEN status = 'active' AND discount_pct IS NOT NULL AND discount_pct > 0 THEN 1 ELSE 0 END), 0) AS discount_products_count
     FROM products`
  );

  const [[salesToday]] = await db.query(
    `SELECT
       COALESCE(SUM(grand_total), 0) AS today_sales,
       COUNT(*) AS today_sale_count
     FROM inventory_sales
     WHERE sale_date = ?`,
    [today]
  );

  const [[profitToday]] = await db.query(
    `SELECT COALESCE(SUM(l.profit_snapshot), 0) AS today_profit
     FROM inventory_sale_lines l
     JOIN inventory_sales s ON s.id = l.sale_id
     WHERE s.sale_date = ?`,
    [today]
  );

  const [[requests]] = await db.query(
    `SELECT COUNT(*) AS pending_requests FROM customer_product_requests WHERE status = 'pending'`
  );

  let qrKpis = { qr_unassigned: 0, qr_in_stock: 0, qr_sold: 0 };
  try {
    const [[qrRow]] = await db.query(
      `SELECT
         SUM(status = 'unassigned') AS unassigned,
         SUM(status = 'in_stock') AS in_stock,
         SUM(status = 'sold') AS sold
       FROM qr_units`
    );
    qrKpis = {
      qr_unassigned: Number(qrRow?.unassigned || 0),
      qr_in_stock: Number(qrRow?.in_stock || 0),
      qr_sold: Number(qrRow?.sold || 0),
    };
  } catch {
    /* qr tables may not exist yet during migration */
  }

  return {
    total_products: Number(productStats?.total_products || 0),
    total_stock_qty: Number(productStats?.total_stock_qty || 0),
    low_stock_count: Number(productStats?.low_stock_count || 0),
    out_of_stock_count: Number(productStats?.out_of_stock_count || 0),
    stock_value: roundMoney(Number(productStats?.stock_value || 0)),
    discount_products_count: Number(productStats?.discount_products_count || 0),
    today_sales: roundMoney(Number(salesToday?.today_sales || 0)),
    today_sale_count: Number(salesToday?.today_sale_count || 0),
    today_profit: roundMoney(Number(profitToday?.today_profit || 0)),
    pending_requests: Number(requests?.pending_requests || 0),
    ...qrKpis,
  };
}

export function validateSaleInput(body) {
  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (!lines.length) return { error: "Add at least one product line." };

  const parsedLines = [];
  for (const line of lines) {
    const productId = num(line.product_id);
    const qty = num(line.qty);
    if (!Number.isFinite(productId) || productId <= 0) return { error: "Invalid product on a line." };
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
      return { error: "Quantity must be a whole number greater than 0." };
    }
    const lineDiscount = num(line.line_discount);
    const qrCodes = Array.isArray(line.qr_codes) ?
      line.qr_codes.map((c) => normalizeQrCode(c)).filter(Boolean)
    : [];
    parsedLines.push({
      product_id: productId,
      qty: Math.floor(qty),
      line_discount: Number.isFinite(lineDiscount) && lineDiscount >= 0 ? lineDiscount : 0,
      qr_codes: qrCodes,
    });
  }

  const saleDate = parseBookDate(body.sale_date) || todayDateString();
  const paymentMethod = String(body.payment_method ?? "cash").trim();
  if (!PAYMENT_METHODS.includes(paymentMethod)) return { error: "Invalid payment method." };
  const saleMode = String(body.sale_mode ?? "cash").trim();
  if (!SALE_MODES.includes(saleMode)) return { error: "Invalid sale mode." };

  const financeDown = body.finance_down_payment != null ? num(body.finance_down_payment) : null;
  const financeTenure =
    body.finance_tenure_months != null ? Math.floor(num(body.finance_tenure_months)) : null;

  return {
    data: {
      sale_date: saleDate,
      lines: parsedLines,
      payment_method: paymentMethod,
      sale_mode: saleMode,
      finance_down_payment: financeDown != null && Number.isFinite(financeDown) ? financeDown : null,
      finance_tenure_months: financeTenure != null && financeTenure > 0 ? financeTenure : null,
      finance_notes: String(body.finance_notes ?? "").trim().slice(0, 200) || null,
      notes: String(body.notes ?? "").trim().slice(0, 200) || null,
      customer_phone: String(body.customer_phone ?? "").replace(/\D/g, "").slice(-10) || null,
      customer_name: String(body.customer_name ?? "").trim().slice(0, 80) || null,
      cart_discount: Math.max(0, num(body.cart_discount) || 0),
      qr_codes: Array.isArray(body.qr_codes) ?
        body.qr_codes.map((c) => normalizeQrCode(c)).filter(Boolean)
      : [],
    },
  };
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

export async function createInventorySale(db, user, input) {
  if (!canEditDayBook(user, input.sale_date)) {
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

    let subtotal = 0;
    let profitTotal = 0;
    const lineRows = [];

    const saleLevelQr = input.qr_codes?.length ? input.qr_codes : null;

    for (const line of input.lines) {
      const lineQr = line.qr_codes?.length ? line.qr_codes : saleLevelQr || [];
      const [prows] = await conn.query(
        `SELECT p.*, c.name AS category_name
         FROM products p
         JOIN product_categories c ON c.id = p.category_id
         WHERE p.id = ? AND p.status = 'active'
         FOR UPDATE`,
        [line.product_id]
      );
      const product = prows[0];
      if (!product) {
        await conn.rollback();
        return { error: "Product not found or inactive." };
      }
      const isSerialized = product.product_type === "serialized";
      if (isSerialized && lineQr.length !== line.qty) {
        await conn.rollback();
        return { error: "Serialized sale requires one QR code per unit." };
      }
      if (isSerialized && lineQr.length) {
        for (const code of lineQr) {
          const [urows] = await conn.query(
            "SELECT * FROM qr_units WHERE code = ? FOR UPDATE",
            [code]
          );
          const qu = urows[0];
          if (!qu || qu.status !== "in_stock" || qu.product_id !== product.id) {
            await conn.rollback();
            return { error: `QR ${code} is not available for this product.` };
          }
        }
      }
      if (Number(product.qty_on_hand) < line.qty) {
        await conn.rollback();
        return { error: `Insufficient stock for ${product.name}.` };
      }

      const unitSelling = Number(product.selling_price) || 0;
      const unitMrp = Number(product.mrp) || 0;
      const purchaseSnap = Number(product.purchase_price) || 0;
      const gross = unitSelling * line.qty;
      const lineTotal = Math.max(0, gross - line.line_discount);
      const profitSnap = roundMoney((unitSelling - purchaseSnap) * line.qty);

      subtotal += lineTotal;
      profitTotal += profitSnap;
      lineRows.push({
        product,
        qty: line.qty,
        unit_mrp: unitMrp,
        unit_selling_price: unitSelling,
        line_discount: line.line_discount,
        line_total: roundMoney(lineTotal),
        purchase_price_snapshot: purchaseSnap,
        profit_snapshot: profitSnap,
        qr_codes: lineQr,
      });
    }

    const discountTotal = roundMoney(input.cart_discount);
    const grandTotal = roundMoney(Math.max(0, subtotal - discountTotal));

    const [saleResult] = await conn.execute(
      `INSERT INTO inventory_sales
        (sale_date, customer_phone, customer_name, subtotal, discount_total, grand_total, payment_method, notes, created_by,
         sale_mode, finance_down_payment, finance_tenure_months, finance_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.sale_date,
        input.customer_phone,
        input.customer_name,
        subtotal,
        discountTotal,
        grandTotal,
        input.payment_method,
        input.notes,
        user.id,
        input.sale_mode || "cash",
        input.finance_down_payment,
        input.finance_tenure_months,
        input.finance_notes,
      ]
    );
    const saleId = saleResult.insertId;

    for (const row of lineRows) {
      const qrCode = row.qr_codes?.[0] || null;
      const [lineResult] = await conn.execute(
        `INSERT INTO inventory_sale_lines
          (sale_id, product_id, qty, unit_mrp, unit_selling_price, line_discount, line_total, purchase_price_snapshot, profit_snapshot, qr_unit_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          saleId,
          row.product.id,
          row.qty,
          row.unit_mrp,
          row.unit_selling_price,
          row.line_discount,
          row.line_total,
          row.purchase_price_snapshot,
          row.profit_snapshot,
          null,
        ]
      );
      const saleLineId = lineResult.insertId;

      if (row.qr_codes?.length && row.product.product_type === "serialized") {
        for (const code of row.qr_codes) {
          const [urows] = await conn.query("SELECT id FROM qr_units WHERE code = ? FOR UPDATE", [code]);
          const quId = urows[0]?.id;
          if (!quId) {
            await conn.rollback();
            return { error: `QR ${code} not found.` };
          }
          await conn.execute(
            `UPDATE qr_units SET status = 'sold', sold_at = NOW(), sale_line_id = ? WHERE id = ?`,
            [saleLineId, quId]
          );
        }
        if (qrCode && row.qty === 1) {
          const [urows] = await conn.query("SELECT id FROM qr_units WHERE code = ? LIMIT 1", [qrCode]);
          if (urows[0]) {
            await conn.execute("UPDATE inventory_sale_lines SET qr_unit_id = ? WHERE id = ?", [
              urows[0].id,
              saleLineId,
            ]);
          }
        }
        await syncSerializedQtyConn(conn, row.product.id);
        await conn.execute(
          `INSERT INTO stock_movements
            (product_id, movement_type, qty_delta, unit_cost, note, ref_type, ref_id, created_by)
           VALUES (?, 'sale', ?, ?, ?, 'inventory_sale', ?, ?)`,
          [
            row.product.id,
            -row.qty,
            row.purchase_price_snapshot,
            `QR sale${row.qr_codes.length ? `: ${row.qr_codes.join(", ")}` : ""}`,
            saleId,
            user.id,
          ]
        );
      } else {
        await applyStockMovement(conn, {
          productId: row.product.id,
          movementType: "sale",
          qtyDelta: -row.qty,
          unitCost: row.purchase_price_snapshot,
          refType: "inventory_sale",
          refId: saleId,
          createdBy: user.id,
        });
      }
    }

    const book = await ensureDayBookConn(conn, input.sale_date, user.id);
    const desc = `Inventory sale #${saleId}`;
    const [ledgerResult] = await conn.execute(
      `INSERT INTO ledger_entries
        (day_book_id, category, amount, description, payment_method, customer_phone, inventory_sale_id, created_by)
       VALUES (?, 'accessory', ?, ?, ?, ?, ?, ?)`,
      [
        book.id,
        grandTotal,
        desc,
        input.payment_method,
        input.customer_phone,
        saleId,
        user.id,
      ]
    );

    await conn.execute("UPDATE inventory_sales SET ledger_entry_id = ? WHERE id = ?", [
      ledgerResult.insertId,
      saleId,
    ]);

    await conn.commit();

    const sale = await loadSaleById(db, saleId);
    return { sale, profit_total: roundMoney(profitTotal) };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function loadSaleById(db, saleId) {
  const [sales] = await db.query(
    `SELECT s.*, u.name AS created_by_name
     FROM inventory_sales s
     LEFT JOIN users u ON u.id = s.created_by
     WHERE s.id = ?
     LIMIT 1`,
    [saleId]
  );
  const sale = sales[0];
  if (!sale) return null;

  const [lines] = await db.query(
    `SELECT l.*, p.name AS product_name, p.brand AS product_brand, p.sku
     FROM inventory_sale_lines l
     JOIN products p ON p.id = l.product_id
     WHERE l.sale_id = ?
     ORDER BY l.id`,
    [saleId]
  );

  return {
    id: sale.id,
    sale_date: sale.sale_date,
    customer_phone: sale.customer_phone,
    customer_name: sale.customer_name,
    subtotal: Number(sale.subtotal),
    discount_total: Number(sale.discount_total),
    grand_total: Number(sale.grand_total),
    payment_method: sale.payment_method,
    notes: sale.notes,
    ledger_entry_id: sale.ledger_entry_id,
    created_by_name: sale.created_by_name,
    created_at: sale.created_at,
    lines: lines.map((l) => ({
      id: l.id,
      product_id: l.product_id,
      product_name: l.product_name,
      product_brand: l.product_brand,
      sku: l.sku,
      qty: l.qty,
      unit_mrp: Number(l.unit_mrp),
      unit_selling_price: Number(l.unit_selling_price),
      line_discount: Number(l.line_discount),
      line_total: Number(l.line_total),
      purchase_price_snapshot: Number(l.purchase_price_snapshot),
      profit_snapshot: Number(l.profit_snapshot),
    })),
    profit_total: roundMoney(lines.reduce((s, l) => s + Number(l.profit_snapshot), 0)),
  };
}

export function validateRequestInput(body) {
  const name = String(body.customer_name ?? "").trim();
  const productRequested = String(body.product_requested ?? "").trim();
  if (!name) return { error: "Customer name is required." };
  if (!productRequested) return { error: "Product requested is required." };
  const qty = num(body.qty);
  const expected = body.expected_price === "" || body.expected_price == null ? null : num(body.expected_price);
  const phone = String(body.customer_phone ?? "").replace(/\D/g, "").slice(-10) || null;
  if (phone && phone.length !== 10) return { error: "Enter a valid 10-digit mobile or leave blank." };
  return {
    data: {
      customer_name: name.slice(0, 80),
      customer_phone: phone,
      product_requested: productRequested.slice(0, 120),
      qty: Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1,
      expected_price: expected != null && Number.isFinite(expected) ? expected : null,
      notes: String(body.notes ?? "").trim().slice(0, 200) || null,
      request_date: parseBookDate(body.request_date) || adminTodayIso(),
    },
  };
}
