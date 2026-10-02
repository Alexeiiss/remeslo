import { NextResponse, type NextRequest } from "next/server";
import { isValidIco, lookupIco } from "@/lib/ares";

// GET /api/ares?ico=12345678 → údaje firmy z ARES (používá formulář registrace a profilu)
export async function GET(request: NextRequest) {
  const ico = (request.nextUrl.searchParams.get("ico") || "").replace(/\s/g, "");
  if (!isValidIco(ico)) {
    return NextResponse.json({ error: "IČO není platné. Zkontrolujte, že má 8 číslic a není v něm překlep." }, { status: 400 });
  }
  try {
    const company = await lookupIco(ico);
    if (!company) return NextResponse.json({ error: "Toto IČO v ARES neexistuje." }, { status: 404 });
    if (!company.active) return NextResponse.json({ error: "Subjekt s tímto IČO podle ARES zanikl." }, { status: 410 });
    return NextResponse.json(company);
  } catch (e) {
    console.error("[ares]", e);
    return NextResponse.json({ error: "ARES teď neodpovídá. Údaje vyplňte ručně, nebo to zkuste za chvíli." }, { status: 502 });
  }
}
