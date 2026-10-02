import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { requireMe } from "@/lib/session";
import { humanError } from "@/lib/config";

export const metadata = { title: "Řemeslnický profil" };

async function saveProfile(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { count } = await supabase.from("provider_profiles").select("user_id", { count: "exact", head: true }).eq("user_id", user!.id);
  const ico = String(formData.get("ico") || "").replace(/\s/g, "");
  if (ico && !/^\d{8}$/.test(ico)) redirect(`/remeslnik/profil?chyba=${encodeURIComponent("IČO musí mít 8 číslic.")}`);

  const { error } = await supabase.rpc("upsert_provider_profile", {
    p_company_name: String(formData.get("company_name") || ""),
    p_ico: ico,
    p_description: String(formData.get("description") || ""),
    p_city: String(formData.get("city") || ""),
    p_category_ids: formData.getAll("categories").map(Number),
    p_region_ids: formData.getAll("regions").map(Number),
  });
  if (error) redirect(`/remeslnik/profil?chyba=${encodeURIComponent(humanError(error.message))}`);
  revalidatePath("/", "layout");
  redirect(count ? "/remeslnik/profil?ok=1" : "/remeslnik?vitejte=1");
}

type SP = Promise<{ chyba?: string; ok?: string }>;

export default async function ProviderProfile({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const me = await requireMe("/remeslnik/profil");
  const supabase = await createClient();
  const [{ data: profile }, { data: categories }, { data: regions }, { data: myCats }, { data: myRegs }, { data: bonus }] = await Promise.all([
    supabase.from("provider_profiles").select("*").eq("user_id", me.id).maybeSingle(),
    supabase.from("categories").select("id, name").order("sort_order"),
    supabase.from("regions").select("id, name").order("name"),
    supabase.from("provider_categories").select("category_id").eq("provider_id", me.id),
    supabase.from("provider_regions").select("region_id").eq("provider_id", me.id),
    supabase.from("settings").select("value").eq("key", "signup_bonus_credits").single(),
  ]);
  const catSet = new Set(myCats?.map((c) => c.category_id));
  const regSet = new Set(myRegs?.map((r) => r.region_id));

  return (
    <main className="container" style={{ maxWidth: 760 }}>
      <h1>{profile ? "Řemeslnický profil" : "Staňte se řemeslníkem"}</h1>
      {!profile && <div className="alert info">Po uložení profilu dostanete <strong>{String(bonus?.value ?? 200)} kreditů zdarma</strong> a uvidíte poptávky ve svých oborech.</div>}
      {sp.chyba && <div className="alert error">{sp.chyba}</div>}
      {sp.ok && <div className="alert ok">Profil uložen.</div>}

      <form action={saveProfile} className="card">
        <div className="grid grid-2">
          <div className="field"><label>Název firmy / jméno</label><input type="text" name="company_name" required defaultValue={profile?.company_name ?? me.full_name ?? ""} /></div>
          <div className="field"><label>IČO</label><input type="text" name="ico" inputMode="numeric" maxLength={10} defaultValue={profile?.ico ?? ""} /></div>
        </div>
        <div className="field"><label>Město / sídlo</label><input type="text" name="city" defaultValue={profile?.city ?? ""} /></div>
        <div className="field">
          <label>O vás</label>
          <textarea name="description" defaultValue={profile?.description ?? ""} placeholder="Zkušenosti, specializace, certifikace, reference…" />
        </div>
        <div className="field">
          <label>Obory, ve kterých pracujete</label>
          <div className="checks">
            {categories?.map((c) => (
              <label key={c.id}><input type="checkbox" name="categories" value={c.id} defaultChecked={catSet.has(c.id)} />{c.name}</label>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Kraje, kde pracujete</label>
          <div className="checks">
            {regions?.map((r) => (
              <label key={r.id}><input type="checkbox" name="regions" value={r.id} defaultChecked={regSet.has(r.id)} />{r.name}</label>
            ))}
          </div>
        </div>
        <button className="btn">{profile ? "Uložit profil" : "Uložit a získat kredity"}</button>
      </form>
    </main>
  );
}
