import { NextResponse } from "next/server";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { titleCase } from "@/lib/format";
import { clientIp, deviceFromAgent, distanceKm } from "@/lib/geo";

function clean(body) {
  const lat = Number(body.latitude);
  const lng = Number(body.longitude);
  const accuracy = Number(body.accuracy);

  return {
        name: titleCase(body.name),
    phone: String(body.phone || "").replace(/\D/g, ""),
    brand: String(body.brand || "").trim(),
    problem: String(body.problem || "").trim(),
    note: String(body.note || "").trim(),
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    accuracy: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
  };
}

function validate(values) {
  const errors = {};
  if (values.name.length < 2) errors.name = "Please enter your name.";
  if (!/^[6-9]\d{9}$/.test(values.phone)) {
    errors.phone = "Enter a valid 10-digit Indian mobile number.";
  }
  if (!values.brand) errors.brand = "Please select your phone brand.";
  if (!values.problem) errors.problem = "Please choose the problem type.";
  return errors;
}

export async function POST(request) {
  try {
    const values = clean(await request.json());
    const errors = validate(values);
    if (Object.keys(errors).length) {
      return NextResponse.json({ ok: false, errors }, { status: 400 });
    }

    const userAgent = request.headers.get("user-agent") || "";
    const device = deviceFromAgent(userAgent);
    const ip = clientIp(request);
    const distance = distanceKm(values.latitude, values.longitude);

    await ensureLeadsTable();
    await getPool().execute(
      `INSERT INTO leads
        (name, phone, brand, problem, note, latitude, longitude, accuracy_m, distance_km, device, user_agent, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        values.name,
        values.phone,
        values.brand,
        values.problem,
        values.note || null,
        values.latitude,
        values.longitude,
        values.accuracy,
        distance,
        device,
        userAgent.slice(0, 255) || null,
        ip || null,
      ]
    );

    return NextResponse.json({
      ok: true,
      lead: { ...values, distance_km: distance, device },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, message: "Could not save the request. Check MySQL." },
      { status: 500 }
    );
  }
}
