// Napojení na platební bránu Comgate (HTTP POST API v1.0).
// Dokumentace: https://apidoc.comgate.cz/
const BASE = "https://payments.comgate.cz/v1.0";

function creds() {
  const merchant = process.env.COMGATE_MERCHANT_ID;
  const secret = process.env.COMGATE_SECRET;
  if (!merchant || !secret) throw new Error("Chybí COMGATE_MERCHANT_ID nebo COMGATE_SECRET");
  return { merchant, secret, test: process.env.COMGATE_TEST === "true" ? "true" : "false" };
}

async function call(path: string, params: Record<string, string>) {
  const res = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    cache: "no-store",
  });
  const data = Object.fromEntries(new URLSearchParams(await res.text()));
  if (data.code !== "0") throw new Error(`Comgate ${path}: ${data.code} ${data.message}`);
  return data;
}

/** Založí platbu a vrátí adresu, kam přesměrovat zákazníka. */
export async function createPayment(opts: {
  refId: string;      // naše ID platby
  priceCzk: number;   // v Kč
  label: string;      // text na platební stránce (max 16 znaků)
  email: string;
}) {
  const { merchant, secret, test } = creds();
  const data = await call("create", {
    merchant,
    secret,
    test,
    price: String(Math.round(opts.priceCzk * 100)), // v haléřích
    curr: "CZK",
    label: opts.label.slice(0, 16),
    refId: opts.refId,
    email: opts.email,
    method: "ALL",
    prepareOnly: "true",
    country: "CZ",
    lang: "cs",
  });
  return { transId: data.transId, redirect: data.redirect };
}

/** Ověří skutečný stav platby přímo u Comgate (notifikaci samotné nevěříme). */
export async function getPaymentStatus(transId: string) {
  const { merchant, secret } = creds();
  const data = await call("status", { merchant, secret, transId });
  return { status: data.status as "PAID" | "CANCELLED" | "PENDING" | "AUTHORIZED", refId: data.refId };
}

export function isValidNotificationSecret(secret: string | null | undefined) {
  return !!secret && secret === process.env.COMGATE_SECRET;
}
