import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { date, REQUEST_STATUS_LABEL } from "@/lib/config";

type SP = Promise<{ stav?: string }>;

export default async function AdminRequests({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("job_requests")
    .select("id, title, city, status, offers_count, created_at, categories(name), profiles!job_requests_customer_id_fkey(full_name, email)")
    .order("created_at", { ascending: false }).limit(100);
  if (sp.stav) query = query.eq("status", sp.stav);
  const { data: list } = await query;

  return (
    <section className="stack">
      <h1>Poptávky</h1>
      <div className="row" style={{ gap: 6 }}>
        <Link href="/admin/poptavky" className="badge">Všechny</Link>
        {Object.entries(REQUEST_STATUS_LABEL).map(([k, v]) => (
          <Link key={k} href={`/admin/poptavky?stav=${k}`} className={`badge ${k}`}>{v}</Link>
        ))}
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Poptávka</th><th>Zákazník</th><th>Stav</th><th className="num">Nabídky</th></tr></thead>
          <tbody>
            {list?.map((r) => {
              const c = r.profiles as unknown as { full_name: string; email: string } | null;
              return (
                <tr key={r.id}>
                  <td><Link href={`/poptavka/${r.id}`}>{r.title}</Link>
                    <div className="small muted">{(r.categories as unknown as { name: string })?.name} · {r.city} · {date(r.created_at)}</div></td>
                  <td className="small">{c?.full_name}<div className="muted">{c?.email}</div></td>
                  <td><span className={`badge ${r.status}`}>{REQUEST_STATUS_LABEL[r.status]}</span></td>
                  <td className="num">{r.offers_count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
