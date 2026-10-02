import Link from "next/link";
import { createAdminClient, createClient } from "@/lib/supabase";
import { requireMe } from "@/lib/session";
import { getPaymentStatus } from "@/lib/comgate";

export const metadata = { title: "Výsledek platby" };

// Sem Comgate vrátí zákazníka po platbě.
// V portálu Comgate nastavte návratové URL: https://vasweb.cz/platba/vysledek?id=${refId}
export default async function PaymentResult({ searchParams }: { searchParams: Promise<{ id?: string; refId?: string }> }) {
  const sp = await searchParams;
  await requireMe("/remeslnik/kredity");
  const paymentId = sp.id || sp.refId;
  const supabase = await createClient();

  // RLS: uživatel vidí jen svou platbu
  let { data: p } = paymentId
    ? await supabase.from("payments").select("id, status, credits, gateway_ref").eq("id", paymentId).maybeSingle()
    : { data: null };

  // Notifikace mohla dorazit později než zákazník – ověříme stav sami
  if (p && p.status === "pending" && p.gateway_ref) {
    try {
      const { status } = await getPaymentStatus(p.gateway_ref);
      if (status === "PAID") {
        await createAdminClient().rpc("confirm_payment", { p_payment_id: p.id, p_gateway_ref: p.gateway_ref });
        p = { ...p, status: "paid" };
      }
      if (status === "CANCELLED") p = { ...p, status: "cancelled" };
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <main className="container" style={{ maxWidth: 560 }}>
      <div className="card">
        {!p && <><h1>Platba nenalezena</h1><p className="muted">Pokud jste platili, kredity se připíšou během pár minut.</p></>}
        {p?.status === "paid" && <><h1>Děkujeme, zaplaceno ✓</h1><p>Na váš účet jsme připsali <strong>{p.credits} kreditů</strong>.</p></>}
        {p?.status === "pending" && <><h1>Platba se zpracovává</h1><p className="muted">Kredity se připíšou automaticky, jakmile banka platbu potvrdí. U převodu to může trvat déle.</p></>}
        {(p?.status === "cancelled" || p?.status === "failed") && <><h1>Platba neproběhla</h1><p className="muted">Nic jsme vám nestrhli. Můžete to zkusit znovu.</p></>}
        <div className="row" style={{ marginTop: 16 }}>
          <Link href="/remeslnik/kredity" className="btn">Moje kredity</Link>
          <Link href="/remeslnik" className="btn secondary">Poptávky</Link>
        </div>
      </div>
    </main>
  );
}
