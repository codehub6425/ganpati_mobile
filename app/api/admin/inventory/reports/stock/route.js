import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { getDashboardKpis } from "@/lib/inventory";
import { isStaffUser } from "@/lib/roles";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

async function requireStaff() {
  const user = await getSessionUser();
  if (!isStaffUser(user)) {
    return { error: NextResponse.json({ ok: false, message: "Login required." }, { status: 401 }) };
  }
  return { user };
}

export async function GET(request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const format = new URL(request.url).searchParams.get("format");
  try {
    await ensureLeadsTable();
    const db = getPool();
    const kpis = await getDashboardKpis(db);
    const [products] = await db.query(
      `SELECT p.name, p.brand, p.product_type, p.qty_on_hand, p.selling_price, p.status, c.name AS category_name
       FROM products p JOIN product_categories c ON c.id = p.category_id
       ORDER BY p.name ASC LIMIT 500`
    );
    const [lowStock] = await db.query(
      `SELECT p.name, p.qty_on_hand, p.min_stock_level FROM products p
       WHERE p.status = 'active' AND p.qty_on_hand > 0 AND p.qty_on_hand <= p.min_stock_level
       ORDER BY p.qty_on_hand ASC LIMIT 50`
    );

    if (format === "pdf") {
      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text("Inventory stock report", 14, 16);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 22);
      doc.text(
        `Products: ${kpis.total_products} | Stock qty: ${kpis.total_stock_qty} | Low: ${kpis.low_stock_count} | QR in stock: ${kpis.qr_in_stock || 0}`,
        14,
        28
      );
      autoTable(doc, {
        startY: 34,
        head: [["Product", "Category", "Type", "Qty", "Price", "Status"]],
        body: products.map((p) => [
          p.name,
          p.category_name,
          p.product_type,
          String(p.qty_on_hand),
          String(p.selling_price),
          p.status,
        ]),
      });
      if (lowStock.length) {
        const y = doc.lastAutoTable.finalY + 10;
        doc.text("Low stock", 14, y);
        autoTable(doc, {
          startY: y + 4,
          head: [["Product", "On hand", "Min"]],
          body: lowStock.map((p) => [p.name, String(p.qty_on_hand), String(p.min_stock_level)]),
        });
      }
      const pdf = Buffer.from(doc.output("arraybuffer"));
      return new NextResponse(pdf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="inventory-stock-report.pdf"',
        },
      });
    }

    return NextResponse.json({ ok: true, kpis, products, low_stock: lowStock });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Report failed." }, { status: 500 });
  }
}
