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

  return (
    <main className="container stack" style={{ maxWidth: 860 }}>
      {sp.zrusena && <div className="alert ok">Poptávka byla zrušena.</div>}
      <div className="row between">
        <h1 style={{ margin: 0 }}>Moje poptávky</h1>
        <Link href="/poptavka/nova" className="btn accent">Nová poptávka</Link>
      </div>
      {!requests?.length && <div className="card muted">Zatím nemáte žádnou poptávku.</div>}
      {requests?.map((r) => (
        <Link key={r.id} href={`/poptavka/${r.id}`} className="card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
          <div className="row between">
            <strong>{r.title}</strong>
            <span className={`badge ${r.status}`}>{REQUEST_STATUS_LABEL[r.status]}</span>
          </div>
          <div className="small muted" style={{ marginTop: 4 }}>
            {(r.categories as unknown as { name: string } | null)?.name} · {r.city} · {date(r.created_at)}
            {r.status === "open" && <> · <strong>{r.offers_count} {r.offers_count === 1 ? "nabídka" : r.offers_count >= 2 && r.offers_count <= 4 ? "nabídky" : "nabídek"}</strong></>}
          </div>
        </Link>
      ))}
    </main>
  );
}
