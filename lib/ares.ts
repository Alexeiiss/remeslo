// Napojení na ARES (Administrativní registr ekonomických subjektů, Ministerstvo financí).
// Veřejné REST API, bez klíče: https://ares.gov.cz/
const ARES = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty";

export type AresCompany = {
  ico: string;
  name: string;
  address: string;      // celá adresa sídla, např. „Na Františku 106/4, Liberec X-Františkov, 46010 Liberec“
  street: string;       // „Na Františku 106/4“
  city: string;         // „Liberec“
  zip: string;          // „46010“
  regionName: string;   // „Liberecký kraj“
  dic: string | null;
  active: boolean;      // false = subjekt zanikl
};

/** Kontrola IČO podle kontrolního součtu (modulo 11) – odhalí překlepy bez dotazu do ARES */
export function isValidIco(ico: string) {
  if (!/^\d{8}$/.test(ico)) return false;
  const d = ico.split("").map(Number);
  const sum = d.slice(0, 7).reduce((s, n, i) => s + n * (8 - i), 0);
  const check = (11 - (sum % 11)) % 10;
  return check === d[7];
}

export async function lookupIco(icoRaw: string): Promise<AresCompany | null> {
  const ico = icoRaw.replace(/\s/g, "").padStart(8, "0");
  if (!isValidIco(ico)) return null;
  const res = await fetch(`${ARES}/${ico}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 86400 },
  });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`ARES ${res.status}`);
  const j = await res.json();
  const s = j.sidlo ?? {};
  const house = [s.cisloDomovni, s.cisloOrientacni].filter(Boolean).join("/");
  const street = s.nazevUlice
    ? `${s.nazevUlice} ${house}`.trim()
    : `${s.nazevCastiObce ?? s.nazevObce ?? ""} ${house}`.trim();
  return {
    ico,
    name: j.obchodniJmeno ?? "",
    address: s.textovaAdresa ?? [street, `${s.psc ?? ""} ${s.nazevObce ?? ""}`.trim()].filter(Boolean).join(", "),
    street,
    city: s.nazevObce ?? "",
    zip: s.psc ? String(s.psc) : "",
    regionName: s.nazevKraje ?? "",
    dic: j.dic ?? null,
    active: !j.datumZaniku,
  };
}
