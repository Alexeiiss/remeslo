import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { czk } from "@/lib/config";

export default async function AdminHome() {
  const supabase = await createClient();
  const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;

  const [customers, providers, openReq, assigned30, newReq30, disputes, paid30] = await Promise.all([
    count(supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer")),
    count(supabase.from("provider_profiles").select("user_id", { count: "exact", head: true })),
    count(supabase.from("job_requests").select("id", { count: "exact", head: true }).eq("status", "open")),
    count(supabase.from("job_requests").select("id", { count: "exact", head: true }).eq("status", "assigned").gte("closed_at", since30)),
    count(supabase.from("job_requests").select("id", { count: "exact", head: true }).gte("created_at", since30)),
    count(supabase.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open")),
    supabase.from("payments").select("price_czk").eq("status", "paid").gte("paid_at", since30),
  ]);
  const revenue30 = (paid30.data ?? []).reduce((s, p) => s + p.price_czk, 0);

  const tiles: [string, string | number, string?][] = [
    ["Zákazníci", customers], ["Řemeslníci", providers], ["Otevřené poptávky", openReq],
    ["Nové poptávky (30 dní)", newReq30], ["Přidělené zakázky (30 dní)", assigned30],
    ["Tržby z kreditů (30 dní)", czk(revenue30)],
    ["Úspěšnost poptávek (30 dní)", newReq30 ? `${Math.round((assigned30 / newReq30) * 100)} %` : "–"],
  ];

  return (
    <>
      {disputes > 0 && (
        <div className="alert error">
          Čeká {disputes} {disputes === 1 ? "reklamace" : "reklamací"} na vyřízení. <Link href="/admin/reklamace">Vyřídit →</Link>
        </div>
      )}
      <div className="grid grid-3">
        {tiles.map(([label, value]) => (
          <div key={label} className="card"><div className="small muted">{label}</div><div className="big">{value}</div></div>
        ))}
      </div>
      <p className="small muted">Úspěšnost poptávek = kolik zákazníků si vybralo řemeslníka. Hlavní číslo, které ukazuje, jestli portál funguje: řemeslníci platí jen za vybrané zakázky.</p>
    </>
  );
}
