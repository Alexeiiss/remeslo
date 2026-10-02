import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { requireMe } from "@/lib/session";
import { humanError } from "@/lib/config";
import PhoneVerify from "@/components/PhoneVerify";

export const metadata = { title: "Můj účet" };

async function save(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_profile", {
    p_full_name: String(formData.get("full_name") || ""),
    p_phone: String(formData.get("phone") || ""),
  });
  if (error) redirect(`/ucet?chyba=${encodeURIComponent(humanError(error.message))}`);
  revalidatePath("/", "layout");
  const next = String(formData.get("dalsi") || "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/ucet?ok=1");
}

type SP = Promise<{ chyba?: string; ok?: string; dalsi?: string }>;

export default async function AccountPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const me = await requireMe("/ucet");
  const supabase = await createClient();
  const { data: prof } = await supabase.from("profiles").select("phone_verified").eq("id", me.id).single();

  return (
    <main className="container" style={{ maxWidth: 520 }}>
      {sp.chyba && <div className="alert error">{sp.chyba}</div>}
      {sp.ok && <div className="alert ok">Uloženo.</div>}
      <div className="card">
        <h1>Můj účet</h1>
        <p className="muted">{me.email}</p>
        <form action={save}>
          <input type="hidden" name="dalsi" value={sp.dalsi || ""} />
          <div className="field"><label>Jméno a příjmení</label><input type="text" name="full_name" defaultValue={me.full_name ?? ""} /></div>
          <div className="field">
            <label>Telefon</label>
            <input type="tel" name="phone" defaultValue={me.phone ?? ""} required />
            <div className="hint">Ukáže se jen protistraně, až se domluvíte.</div>
          </div>
          <button className="btn">Uložit</button>
        </form>
      </div>
      <div className="card">
        <h2>Ověření telefonu</h2>
        <PhoneVerify phone={me.phone} verified={!!prof?.phone_verified} />
      </div>
    </main>
  );
}
