import { createAdminClient } from "./supabase";
import { fakturoidEnabled, invoiceCredits } from "./fakturoid";

/**
 * Po potvrzení platby: vystaví fakturu (pokud je napojený Fakturoid).
 * Je bezpečné volat opakovaně – faktura vznikne jen jednou.
 * Chyba fakturace nikdy nezruší připsání kreditů.
 */
export async function afterPaymentConfirmed(paymentId: string) {
  if (!fakturoidEnabled()) return;
  const admin = createAdminClient();
  const { data: p } = await admin.from("payments")
    .select("id, provider_id, credits, price_czk, paid_at, invoice_id, status")
    .eq("id", paymentId).single();
  if (!p || p.status !== "paid" || p.invoice_id) return;

  // Zabrat si fakturaci (0 = „právě se vystavuje“), aby souběžný požadavek nevystavil druhou fakturu
  const { data: claimed } = await admin.from("payments")
    .update({ invoice_id: 0 }).eq("id", p.id).is("invoice_id", null).select("id").maybeSingle();
  if (!claimed) return;

  const [{ data: pp }, { data: prof }] = await Promise.all([
    admin.from("provider_profiles").select("company_name, ico, address, city").eq("user_id", p.provider_id).single(),
    admin.from("profiles").select("email").eq("id", p.provider_id).single(),
  ]);

  try {
    const inv = await invoiceCredits({
      customer: { name: pp?.company_name ?? "Řemeslník", ico: pp?.ico, email: prof?.email, address: pp?.address, city: pp?.city },
      credits: p.credits,
      priceCzk: p.price_czk,
      paymentRef: p.id,
      paidOn: p.paid_at ? new Date(p.paid_at) : new Date(),
    });
    await admin.from("payments")
      .update({ invoice_id: inv.id, invoice_number: inv.number, invoice_url: inv.url })
      .eq("id", p.id);
  } catch (e) {
    console.error("[fakturoid] fakturu se nepodařilo vystavit", paymentId, e);
    await admin.from("payments").update({ invoice_id: null }).eq("id", p.id).eq("invoice_id", 0);
  }
}
