import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { date, humanError } from "@/lib/config";
import { requireAdmin } from "@/lib/admin";

async function adjust(formData: FormData) {
  "use server";
  await requireAdmin();
  const supabase = await createClient();
  const q = String(formData.get("q") || "");
  const { error } = await supabase.rpc("admin_adjust_credits", {
    p_provider: String(formData.get("provider_id")),
    p_amount: Math.round(Number(formData.get("amount"))),
    p_note: String(formData.get("note") || ""),
  });
  const base = `/admin/remeslnici?q=${encodeURIComponent(q)}`;
  if (error) redirect(`${base}&chyba=${encodeURIComponent(humanError(error.message))}`);
  revalidatePath("/admin/remeslnici");
  redirect(`${base}&ok=1`);
}

type SP = Promise<{ q?: string; chyba?: string; ok?: string }>;

export default async function AdminProviders({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const supabase = await createClient();

  let query = supabase.from("provider_profiles")
    .select("user_id, company_name, ico, city, rating_avg, rating_count, created_at, profiles(email, phone)")
    .order("created_at", { ascending: false }).limit(50);
  if (q) query = query.or(`company_name.ilike.%${q.replace(/[%,()]/g, "")}%,ico.eq.${q.replace(/\D/g, "") || "x"}`);
  const { data: providers } = await query;

  const ids = (providers ?? []).map((p) => p.user_id);
  const { data: balances } = ids.length
    ? await supabase.from("provider_credit_balance").select("provider_id, available, held").in("provider_id", ids)
    : { data: [] };
  const bal = new Map((balances ?? []).map((b) => [b.provider_id, b]));

  return (
    <section className="stack">
      {sp.chyba && <div className="alert error">{sp.chyba}</div>}
      {sp.ok && <div className="alert ok">Kredity upraveny.</div>}
      <h1>Řemeslníci a kredity</h1>
      <form className="row">
        <input type="text" name="q" defaultValue={q} placeholder="Hledat podle názvu firmy nebo IČO" style={{ maxWidth: 360 }} />
        <button className="btn secondary">Hledat</button>
      </form>
      {!providers?.length && <div className="card muted">Nic nenalezeno.</div>}
      {providers?.map((p) => {
        const pr = p.profiles as unknown as { email: string; phone: string } | null;
        const b = bal.get(p.user_id);
        return (
          <div key={p.user_id} className="card">
            <div className="row between">
              <div>
                <strong><Link href={`/firma/${p.user_id}`}>{p.company_name}</Link></strong>
                <div className="small muted">
                  {p.city}{p.ico && ` · IČO ${p.ico}`} · {pr?.email} · {pr?.phone} · od {date(p.created_at)}
                  {p.rating_count ? ` · ★ ${Number(p.rating_avg).toFixed(1)} (${p.rating_count})` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="big">{b?.available ?? 0}</div>
                <div className="small muted">kreditů · {b?.held ?? 0} blokováno</div>
              </div>
            </div>
            <details style={{ marginTop: 10 }}>
              <summary className="small" style={{ cursor: "pointer" }}>Upravit kredity</summary>
              <form action={adjust} className="row" style={{ marginTop: 8 }}>
                <input type="hidden" name="provider_id" value={p.user_id} />
                <input type="hidden" name="q" value={q} />
                <input type="number" name="amount" required placeholder="např. 100 nebo -50" style={{ maxWidth: 160 }} />
                <input type="text" name="note" placeholder="Důvod (uvidí ho v historii)" style={{ maxWidth: 320 }} />
                <button className="btn secondary">Uložit</button>
              </form>
            </details>
          </div>
        );
      })}
    </section>
  );
}
