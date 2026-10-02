// Napojení na Fakturoid (API v3) – automatické faktury za nákup kreditů.
// Dokumentace: https://www.fakturoid.cz/api/v3
// Nastavení (Vercel → Environment Variables):
//   FAKTUROID_SLUG          – název účtu z adresy app.fakturoid.cz/<slug>
//   FAKTUROID_CLIENT_ID     – Nastavení → Uživatelský účet → API (Client ID)
//   FAKTUROID_CLIENT_SECRET – tamtéž (Client Secret)
//   FAKTUROID_VAT_RATE      – sazba DPH v % (21), nebo 0 pro neplátce (výchozí 0)
//   FAKTUROID_CONTACT_EMAIL – e-mail do hlavičky User-Agent (vyžaduje Fakturoid)

const API = "https://app.fakturoid.cz/api/v3";

export const fakturoidEnabled = () =>
  !!(process.env.FAKTUROID_SLUG && process.env.FAKTUROID_CLIENT_ID && process.env.FAKTUROID_CLIENT_SECRET);

const userAgent = () => `RemesloPortal (${process.env.FAKTUROID_CONTACT_EMAIL || "info@example.com"})`;

let cached: { token: string; expires: number } | null = null;

async function token() {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const basic = Buffer.from(`${process.env.FAKTUROID_CLIENT_ID}:${process.env.FAKTUROID_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`, "Content-Type": "application/json",
      Accept: "application/json", "User-Agent": userAgent(),
    },
    body: JSON.stringify({ grant_type: "client_credentials" }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Fakturoid token ${res.status}: ${await res.text()}`);
  const j = await res.json();
  cached = { token: j.access_token, expires: Date.now() + (j.expires_in ?? 7200) * 1000 };
  return cached.token;
}

async function call<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}/accounts/${process.env.FAKTUROID_SLUG}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await token()}`, "Content-Type": "application/json",
      Accept: "application/json", "User-Agent": userAgent(),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Fakturoid ${method} ${path} ${res.status}: ${await res.text()}`);
  return (res.status === 204 ? null : await res.json()) as T;
}

export type Customer = { name: string; ico?: string | null; email?: string | null; address?: string | null; city?: string | null };

/** Najde odběratele podle IČO (nebo e-mailu), jinak ho založí */
async function subjectId(c: Customer): Promise<number> {
  const query = c.ico || c.email;
  if (query) {
    const found = await call<{ id: number; registration_no?: string; email?: string }[]>(
      "GET", `/subjects/search.json?query=${encodeURIComponent(query)}`);
    const hit = found.find((s) => (c.ico && s.registration_no === c.ico) || (!c.ico && s.email === c.email));
    if (hit) return hit.id;
  }
  // Adresa z ARES má tvar „Ulice 1/2, Část obce, 46010 Město“
  const parts = (c.address ?? "").split(",").map((x) => x.trim());
  const zipCity = parts.at(-1)?.match(/^(\d{3}\s?\d{2})\s+(.+)$/);
  const created = await call<{ id: number }>("POST", "/subjects.json", {
    name: c.name,
    registration_no: c.ico || undefined,
    email: c.email || undefined,
    street: parts[0] || undefined,
    zip: zipCity?.[1]?.replace(/\s/g, ""),
    city: zipCity?.[2] ?? c.city ?? undefined,
    country: "CZ",
    type: "customer",
  });
  return created.id;
}

/** Vystaví fakturu za kredity, označí ji jako zaplacenou a pošle odběrateli e-mailem */
export async function invoiceCredits(opts: {
  customer: Customer; credits: number; priceCzk: number; paymentRef: string; paidOn: Date;
}) {
  const vat = Number(process.env.FAKTUROID_VAT_RATE || 0);
  const invoice = await call<{ id: number; number: string; public_html_url: string }>("POST", "/invoices.json", {
    subject_id: await subjectId(opts.customer),
    custom_id: opts.paymentRef,
    payment_method: "card",
    // Ceny v ceníku jsou konečné (vč. DPH) – u plátce dopočítáme základ
    lines: [{
      name: `Kredity na portálu (${opts.credits} kreditů)`,
      quantity: 1,
      unit_name: "balíček",
      unit_price: vat ? Math.round((opts.priceCzk / (1 + vat / 100)) * 100) / 100 : opts.priceCzk,
      vat_rate: vat,
    }],
  });
  const paidOn = opts.paidOn.toISOString().slice(0, 10);
  await call("POST", `/invoices/${invoice.id}/payments.json`, { paid_on: paidOn, mark_document_as_paid: true });
  try {
    await call("POST", `/invoices/${invoice.id}/message.json`, { deliver_now: true });
  } catch (e) {
    console.error("[fakturoid] e-mail s fakturou se neodeslal", e); // faktura existuje i tak
  }
  return { id: invoice.id, number: invoice.number, url: invoice.public_html_url };
}
