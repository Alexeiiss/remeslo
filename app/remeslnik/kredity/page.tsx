import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase";
import { requireMe } from "@/lib/session";
import { createPayment } from "@/lib/comgate";
import { czk, dateTime, LEDGER_LABEL, SITE_NAME } from "@/lib/config";

export const metadata = { title: "Kredity" };

async function buy(formData: FormData) {
  "use server";
  const me = await requireMe("/remeslnik/kredity");
  if (!me.isProvider) redirect("/remeslnik/profil");
  const supabase = await createClient();
  const { data: pkg } = await supabase.from("credit_packages").select("*").eq("code", String(formData.get("package"))).single();
  if (!pkg) redirect("/remeslnik/kredity?chyba=" + encodeURIComponent("Neznámý balíček."));

  // Platbu zakládá server s plnými právy – uživatel nemůže podvrhnout cenu ani počet kreditů
  const admin = createAdminClient();
  const { data: payment, error } = await admin.from("payments")
    .insert({ provider_id: me.id, package_code: pkg.code, credits: pkg.credits, price_czk: pkg.price_czk })
    .select("id").single();
  if (error || !payment) redirect("/remeslnik/kredity?chyba=" + encodeURIComponent("Platbu se nepodařilo založit."));

  let url: string;
  try {
    const res = await createPayment({ refId: payment.id, priceCzk: pkg.price_czk, label: `${SITE_NAME} kredity`, email: me.email ?? "" });
    await admin.from("payments").update({ gateway_ref: res.transId }).eq("id", payment.id);
    url = res.redirect;
  } catch (e) {
    console.error(e);
    await admin.from("payments").update({ status: "failed" }).eq("id", payment.id);
    redirect("/remeslnik/kredity?chyba=" + encodeURIComponent("Platební brána je nedostupná. Zkuste to prosím později."));
  }
  redirect(url);
}

type SP = Promise<{ chyba?: string }>;

export default async function CreditsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const me = await requireMe("/remeslnik/kredity");
  if (!me.isProvider) redirect("/remeslnik/profil");
  const supabase = await createClient();
  const [{ data: balance }, { data: packages }, { data: ledger }, { data: payments }] = await Promise.all([
    supabase.from("provider_credit_balance").select("available, held").eq("provider_id", me.id).single(),
    supabase.from("credit_packages").select("*").order("sort_order"),
    supabase.from("credit_ledger").select("id, kind, amount, note, created_at, offers(credits_cost)")
      .eq("provider_id", me.id).order("created_at", { ascending: false }).limit(100),
    supabase.from("payments").select("id, price_czk, credits, status, paid_at, created_at")
      .eq("provider_id", me.id).eq("status", "paid").order("created_at", { ascending: false }),
  ]);

  return (
    <main className="container stack">
      {sp.chyba && <div className="alert error">{sp.chyba}</div>}
      <div className="grid grid-2">
        <div className="card"><div className="small muted">Dostupné kredity</div><div className="big">{balance?.available ?? 0}</div></div>
        <div className="card"><div className="small muted">Zablokováno v čekajících nabídkách</div><div className="big">{balance?.held ?? 0}</div><div className="small muted">Vrátí se, pokud si zákazník vybere jiného.</div></div>
      </div>

      <section>
        <h2>Dobít kredity</h2>
        <div className="grid grid-3">
          {packages?.map((p) => (
            <form key={p.code} action={buy} className="card">
              <input type="hidden" name="package" value={p.code} />
              <h3>{p.label}</h3>
              <div className="big">{p.credits} kreditů</div>
              <p className="muted">{czk(p.price_czk)}{p.credits > p.price_czk && <span className="plus"> · +{Math.round((p.credits / p.price_czk - 1) * 100)} % navíc</span>}</p>
              <button className="btn block">Zaplatit kartou / převodem</button>
            </form>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 12 }}>Platba proběhne přes Comgate. Kredity se připíšou hned po zaplacení a platí 12 měsíců.</p>
      </section>

      <section>
        <h2>Historie pohybů</h2>
        <div className="card table-wrap">
          {!ledger?.length ? <p className="muted" style={{ margin: 0 }}>Zatím žádné pohyby.</p> : (
            <table>
              <thead><tr><th>Datum</th><th>Pohyb</th><th className="num">Kredity</th></tr></thead>
              <tbody>
                {ledger.map((l) => {
                  const amount = l.kind === "capture"
                    ? -((l.offers as unknown as { credits_cost: number } | null)?.credits_cost ?? 0)
                    : l.amount;
                  return (
                    <tr key={l.id}>
                      <td className="small">{dateTime(l.created_at)}</td>
                      <td>{LEDGER_LABEL[l.kind]}<div className="small muted">{l.note}</div></td>
                      <td className={`num ${l.kind === "capture" ? "minus" : amount > 0 ? "plus" : amount < 0 ? "muted" : ""}`}>
                        {l.kind === "capture" ? `${amount} (strženo)` : l.kind === "hold" ? `${amount} (blokace)` : amount > 0 ? `+${amount}` : amount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {!!payments?.length && (
        <section>
          <h2>Zaplacené objednávky</h2>
          <div className="card table-wrap">
            <table>
              <thead><tr><th>Datum</th><th className="num">Kredity</th><th className="num">Částka</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}><td>{dateTime(p.paid_at ?? p.created_at)}</td><td className="num">{p.credits}</td><td className="num">{czk(p.price_czk)}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="small muted" style={{ marginTop: 8 }}>Faktury: doplní se napojením na Fakturoid (fáze 2).</p>
          </div>
        </section>
      )}
    </main>
  );
}
