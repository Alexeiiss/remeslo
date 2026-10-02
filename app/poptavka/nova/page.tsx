import { createClient } from "@/lib/supabase";
import { requireMe } from "@/lib/session";
import { createRequest } from "./actions";

export const metadata = { title: "Nová poptávka" };

type SP = Promise<{ chyba?: string; obor?: string }>;

export default async function NewRequestPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  await requireMe("/poptavka/nova" + (sp.obor ? `?obor=${sp.obor}` : ""));
  const supabase = await createClient();
  const [{ data: categories }, { data: regions }, { data: sizes }] = await Promise.all([
    supabase.from("categories").select("id, slug, name").order("sort_order"),
    supabase.from("regions").select("id, name").order("name"),
    supabase.from("job_size_prices").select("size, label").order("sort_order"),
  ]);
  const preselected = categories?.find((c) => c.slug === sp.obor)?.id;

  return (
    <main className="container" style={{ maxWidth: 720 }}>
      <h1>Zadat poptávku</h1>
      <p className="muted">Zdarma. Dostanete až 4 nabídky. Váš telefon a e-mail uvidí jen řemeslník, kterého si vyberete.</p>
      {sp.chyba && <div className="alert error">{sp.chyba}</div>}

      <form action={createRequest} className="card">
        <h2>1. Co potřebujete</h2>
        <div className="field">
          <label>Obor</label>
          <select name="category_id" required defaultValue={preselected ?? ""}>
            <option value="" disabled>Vyberte obor…</option>
            {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Název poptávky</label>
          <input type="text" name="title" required minLength={5} maxLength={120} placeholder="Např. Výměna rozvaděče v rodinném domě" />
        </div>
        <div className="field">
          <label>Popis práce</label>
          <textarea name="description" required minLength={20} maxLength={5000} placeholder="Co přesně je potřeba udělat, rozměry, materiál, stav…" />
        </div>
        <div className="field">
          <label>Fotky <span className="hint">(nepovinné, max. 6 × 2 MB)</span></label>
          <input type="file" name="photos" accept="image/*" multiple />
        </div>

        <h2 style={{ marginTop: 24 }}>2. Kde a kdy</h2>
        <div className="grid grid-2">
          <div className="field">
            <label>Kraj</label>
            <select name="region_id" required defaultValue="">
              <option value="" disabled>Vyberte kraj…</option>
              {regions?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="field"><label>Obec</label><input type="text" name="city" required placeholder="Např. Liberec" /></div>
        </div>
        <div className="field">
          <label>Kdy začít</label>
          <select name="preferred_start" defaultValue="Co nejdříve">
            <option>Co nejdříve</option><option>Do měsíce</option><option>Do 3 měsíců</option><option>Termín je flexibilní</option>
          </select>
        </div>

        <h2 style={{ marginTop: 24 }}>3. Odhad velikosti zakázky</h2>
        <div className="field">
          <select name="size" required defaultValue="">
            <option value="" disabled>Vyberte…</option>
            {sizes?.map((s) => <option key={s.size} value={s.size}>{s.label}</option>)}
          </select>
          <div className="hint">Stačí odhad. Pomůže řemeslníkům rozhodnout, jestli zakázku zvládnou.</div>
        </div>

        <button className="btn accent block">Odeslat poptávku</button>
      </form>
    </main>
  );
}
