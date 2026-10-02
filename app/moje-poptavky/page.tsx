import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { requireMe } from "@/lib/session";
import { date, REQUEST_STATUS_LABEL } from "@/lib/config";

export const metadata = { title: "Moje poptávky" };

export default async function MyRequests({ searchParams }: { searchParams: Promise<{ zrusena?: string }> }) {
  const sp = await searchParams;
  const me = await requireMe("/moje-poptavky");
  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("job_requests")
    .select("id, title, city, status, offers_count, max_offers, created_at, categories(name)")
    .eq("customer_id", me.id)
    .order("created_at", { ascending: false });

  // Nepřečtená upozornění podle poptávky (nové nabídky, zprávy)
  const { data: news } = await supabase.from("notifications")
    .select("request_id, kind").is("read_at", null).not("request_id", "is", null);
  const newsOf = (id: string) => {
    const n = (news ?? []).filter((x) => x.request_id === id);
    const offers = n.filter((x) => x.kind === "new_offer").length;
    const msgs = n.filter((x) => x.kind === "new_message").length;
    return [
      offers && `${offers} ${offers === 1 ? "nová nabídka" : offers <= 4 ? "nové nabídky" : "nových nabídek"}`,
      msgs && `${msgs} ${msgs === 1 ? "nová zpráva" : msgs <= 4 ? "nové zprávy" : "nových zpráv"}`,
    ].filter(Boolean).join(" · ");
  };

  return (
    <main className="container stack" style={{ maxWidth: 860 }}>
      {sp.zrusena && <div className="alert ok">Poptávka byla zrušena.</div>}
      <div className="row between">
        <h1 style={{ margin: 0 }}>Moje poptávky</h1>
        <Link href="/poptavka/nova" className="btn accent">Nová poptávka</Link>
      </div>
      {!requests?.length && <div className="card muted">Zatím nemáte žádnou poptávku.</div>}
      {requests?.map((r) => {
        const n = newsOf(r.id);
        return (
        <Link key={r.id} href={`/poptavka/${r.id}`} className={`card ${n ? "has-news" : ""}`} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
          <div className="row between">
            <strong>{r.title}</strong>
            <span className="row" style={{ gap: 6 }}>
              {n && <span className="news-badge">{n}</span>}
              <span className={`badge ${r.status}`}>{REQUEST_STATUS_LABEL[r.status]}</span>
            </span>
          </div>
          <div className="small muted" style={{ marginTop: 4 }}>
            {(r.categories as unknown as { name: string } | null)?.name} · {r.city} · {date(r.created_at)}
            {r.status === "open" && <> · <strong>{r.offers_count} {r.offers_count === 1 ? "nabídka" : r.offers_count >= 2 && r.offers_count <= 4 ? "nabídky" : "nabídek"}</strong></>}
          </div>
        </Link>
        );
      })}
    </main>
  );
}
