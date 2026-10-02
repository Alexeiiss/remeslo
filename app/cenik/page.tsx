import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { czk } from "@/lib/config";

export const metadata = { title: "Ceník pro řemeslníky" };

export default async function Pricing() {
  const supabase = await createClient();
  const [{ data: prices }, { data: packages }, { data: bonus }] = await Promise.all([
    supabase.from("job_size_prices").select("*").order("sort_order"),
    supabase.from("credit_packages").select("*").order("sort_order"),
    supabase.from("settings").select("value").eq("key", "signup_bonus_credits").single(),
  ]);

  return (
    <main className="container stack">
      <div>
        <h1>Platíte jen za zakázky, které opravdu dostanete</h1>
        <p className="muted">Poptávky prohlížíte zdarma. Při odeslání nabídky se kredity jen zablokují. Když si vás zákazník vybere, strhnou se. Když ne, vrátí se vám celé.</p>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Cena za získanou zakázku</h2>
          <table>
            <tbody>
              {prices?.map((p) => (
                <tr key={p.size}><td>{p.label}</td><td className="num"><strong>{p.credits} kreditů</strong></td></tr>
              ))}
            </tbody>
          </table>
          <p className="small muted" style={{ marginTop: 12 }}>1 kredit = 1 Kč. Na jednu poptávku soutěží nejvýš 4 řemeslníci.</p>
        </div>

        <div className="card">
          <h2>Balíčky kreditů</h2>
          <table>
            <tbody>
              {packages?.map((p) => (
                <tr key={p.code}>
                  <td>{p.label}<div className="small muted">{p.credits} kreditů</div></td>
                  <td className="num"><strong>{czk(p.price_czk)}</strong>
                    {p.credits > p.price_czk && <div className="small plus">+{Math.round((p.credits / p.price_czk - 1) * 100)} % navíc</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Kdy se kredity vrací</h2>
        <ul>
          <li>Zákazník vybral jiného řemeslníka: <strong>okamžitě</strong></li>
          <li>Zákazník poptávku zrušil: <strong>okamžitě</strong></li>
          <li>Zákazník nikoho nevybral do 30 dnů: <strong>automaticky</strong></li>
          <li>Svou nabídku stáhnete dřív, než zákazník vybere: <strong>okamžitě</strong></li>
        </ul>
      </div>

      <div className="card promise row between">
        <div>
          <h2 style={{ margin: 0 }}>Začněte s {bonus?.value ?? 200} kredity zdarma</h2>
          <p className="muted" style={{ margin: 0 }}>Registrace je zdarma, kredity dostanete hned po vyplnění profilu.</p>
        </div>
        <Link href="/prihlaseni?registrace=remeslnik" className="btn accent">Registrovat se</Link>
      </div>
    </main>
  );
}
