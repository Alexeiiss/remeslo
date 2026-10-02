import Link from "next/link";
import PhotoUploader from "@/components/PhotoUploader";
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

type SP = Promise<{ chyba?: string; ok?: string; foto?: string }>;

const MAX_WORK_PHOTOS = 12;

async function deletePhoto(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const id = String(formData.get("photo_id"));
  const { data: ph } = await supabase.from("provider_photos").select("storage_path").eq("id", id).eq("provider_id", user!.id).maybeSingle();
  if (ph) {
    await supabase.storage.from("provider-photos").remove([ph.storage_path]);
    await supabase.from("provider_photos").delete().eq("id", id);
  }
  revalidatePath("/remeslnik/profil");
  revalidatePath(`/firma/${user!.id}`);
  redirect("/remeslnik/profil#fotky");
}

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
  const { data: photos } = profile
    ? await supabase.from("provider_photos").select("id, storage_path").eq("provider_id", me.id).order("created_at", { ascending: false })
    : { data: null };

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

      {profile && (
        <section id="fotky" className="card" style={{ marginTop: 16 }}>
          <div className="row between">
            <h2 style={{ margin: 0 }}>Ukázky vašich prací</h2>
            <Link href={`/firma/${me.id}`} className="small">Zobrazit veřejný profil →</Link>
          </div>
          <p className="muted small">Fotky hotových zakázek se ukážou na vašem veřejném profilu. Zákazníci podle nich vybírají. Max. {MAX_WORK_PHOTOS} fotek, velké fotky z mobilu se automaticky zmenší.</p>
          {!!photos?.length && (
            <div className="photos" style={{ marginBottom: 16 }}>
              {photos.map((ph) => (
                <form key={ph.id} action={deletePhoto} style={{ position: "relative" }}>
                  <input type="hidden" name="photo_id" value={ph.id} />
                  <img src={supabase.storage.from("provider-photos").getPublicUrl(ph.storage_path).data.publicUrl} alt="Ukázka práce" />
                  <button title="Smazat" style={{
                    position: "absolute", top: 4, right: 4, border: 0, borderRadius: 6, cursor: "pointer",
                    background: "rgba(0,0,0,.6)", color: "#fff", padding: "2px 7px",
                  }}>✕</button>
                </form>
              ))}
            </div>
          )}
          <PhotoUploader bucket="provider-photos" folder={me.id} table="provider_photos"
            row={{ provider_id: me.id }} max={MAX_WORK_PHOTOS} current={photos?.length ?? 0} />
        </section>
      )}
    </main>
  );
}
