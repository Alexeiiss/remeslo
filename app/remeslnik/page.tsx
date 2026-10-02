import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { requireMe } from "@/lib/session";
import { czk, date, JOB_SIZE_LABEL, OFFER_STATUS_LABEL } from "@/lib/config";

export const metadata = { title: "Poptávky pro řemeslníky" };

export default async function ProviderDashboard() {
  const me = await requireMe("/remeslnik");
  if (!me.isProvider) redirect("/remeslnik/profil");
  const supabase = await createClient();

  const [{ data: myRegions }, { data: myOffers }, { data: balance }, { data: prices }] = await Promise.all([
    supabase.from("provider_regions").select("region_id").eq("provider_id", me.id),
    supabase.from("offers")
      .select("id, price_czk, status, credits_cost, created_at, job_requests(id, title, city)")
      .eq("provider_id", me.id).order("created_at", { ascending: false }).limit(30),
    supabase.from("provider_credit_balance").select("available, held").eq("provider_id", me.id).single(),
    supabase.from("job_size_prices").select("size, credits"),
  ]);
  const regionIds = (myRegions ?? []).map((r) => r.region_id);
  const offeredIds = new Set((myOffers ?? []).map((o) => (o.job_requests as unknown as { id: string })?.id));
  const priceOf = Object.fromEntries((prices ?? []).map((p) => [p.size, p.credits]));

  // RLS už vrací jen otevřené poptávky v mých oborech; tady zúžíme na moje kraje
  const { data: open } = await supabase
    .from("job_requests")
    .select("id, title, city, size, offers_count, max_offers, created_at, categories(name), regions(name)")
    .eq("status", "open")
    .in("region_id", regionIds.length ? regionIds : [-1])
    .neq("customer_id", me.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const available = (open ?? []).filter((r) => !offeredIds.has(r.id) && r.offers_count < r.max_offers);

  // Nepřečtená upozornění (nové poptávky, výběr, zprávy) – zvýrazní se v seznamech
  const { data: news } = await supabase.from("notifications")
    .select("request_id, kind").is("read_at", null).not("request_id", "is", null);
  const unreadReq = new Set((news ?? []).map((n) => n.request_id));

  return (
    <main className="container stack">
      <div className="grid grid-3">
        <div className="card"><div className="small muted">Dostupné kredity</div><div className="big">{balance?.available ?? 0}</div><Link href="/remeslnik/kredity" className="small">Dobít →</Link></div>
        <div className="card"><div className="small muted">Zablokováno v nabídkách</div><div className="big">{balance?.held ?? 0}</div><div className="small muted">vrátí se, pokud vás nevyberou</div></div>
        <div className="card"><div className="small muted">Nové poptávky pro vás</div><div className="big">{available.length}</div></div>
      </div>

      <section className="stack">
        <h2>Nové poptávky ve vašich oborech a krajích</h2>
        {!available.length && <div className="card muted">Teď tu nic nového není. Nové poptávky vám pošleme e-mailem.</div>}
        {available.map((r) => (
          <Link key={r.id} href={`/poptavka/${r.id}`} className={`card ${unreadReq.has(r.id) ? "has-news" : ""}`} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
            <div className="row between">
              <strong>{r.title}</strong>
              <span className="row" style={{ gap: 6 }}>
                {unreadReq.has(r.id) && <span className="news-badge">Nová</span>}
                <span className="badge open">{r.offers_count}/{r.max_offers} nabídek</span>
              </span>
            </div>
            <div className="small muted" style={{ marginTop: 4 }}>
              {(r.categories as unknown as { name: string })?.name} · {r.city}, {(r.regions as unknown as { name: string })?.name} · {JOB_SIZE_LABEL[r.size]} · {date(r.created_at)}
              {" · "}<strong>{priceOf[r.size]} kreditů při získání</strong>
            </div>
          </Link>
        ))}
      </section>

      <section>
        <h2>Moje nabídky</h2>
        <div className="card table-wrap">
          {!myOffers?.length ? <p className="muted" style={{ margin: 0 }}>Zatím jste neposlali žádnou nabídku.</p> : (
            <table>
              <thead><tr><th>Poptávka</th><th className="num">Cena</th><th>Stav</th><th className="num">Kredity</th></tr></thead>
              <tbody>
                {myOffers.map((o) => {
                  const jr = o.job_requests as unknown as { id: string; title: string; city: string };
                  return (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/poptavka/${jr.id}`} style={{ fontWeight: unreadReq.has(jr.id) ? 700 : 400 }}>{jr.title}</Link>
                        {unreadReq.has(jr.id) && <> <span className="news-badge">novinka</span></>}
                        <div className="small muted">{jr.city} · {date(o.created_at)}</div>
                      </td>
                      <td className="num">{czk(o.price_czk)}</td>
                      <td><span className={`badge ${o.status}`}>{OFFER_STATUS_LABEL[o.status]}</span></td>
                      <td className="num">{o.credits_cost}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}
