"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { SITE_URL } from "@/lib/config";
import { isValidIco, lookupIco } from "@/lib/ares";
import { LEGAL_VALID_FROM } from "@/lib/legal";

const safeNext = (v: FormDataEntryValue | null) => {
  const s = String(v || "");
  return s.startsWith("/") && !s.startsWith("//") ? s : "";
};

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const next = safeNext(formData.get("dalsi"));
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")).trim(),
    password: String(formData.get("password")),
  });
  if (error) {
    redirect(`/prihlaseni?chyba=${encodeURIComponent("Špatný e-mail nebo heslo.")}&dalsi=${encodeURIComponent(next)}`);
  }
  const { data: { user } } = await supabase.auth.getUser();
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  redirect(next || (p?.role === "provider" ? "/remeslnik" : "/moje-poptavky"));
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const isProvider = formData.get("typ") === "remeslnik";
  const next = safeNext(formData.get("dalsi")) || (isProvider ? "/remeslnik/profil" : "/poptavka/nova");
  const password = String(formData.get("password"));
  const back = `/prihlaseni?registrace=${isProvider ? "remeslnik" : "zakaznik"}&dalsi=${encodeURIComponent(next)}`;

  if (password.length < 8) redirect(`${back}&chyba=${encodeURIComponent("Heslo musí mít aspoň 8 znaků.")}`);
  if (!formData.get("terms")) redirect(`${back}&chyba=${encodeURIComponent("Pro registraci je potřeba souhlasit s obchodními podmínkami.")}`);

  // Řemeslník musí mít platné IČO, ověříme ho v ARES
  let company: Awaited<ReturnType<typeof lookupIco>> = null;
  if (isProvider) {
    const ico = String(formData.get("ico") || "").replace(/\s/g, "");
    if (!isValidIco(ico)) redirect(`${back}&chyba=${encodeURIComponent("Zadejte platné IČO (8 číslic).")}`);
    try {
      company = await lookupIco(ico);
    } catch {
      company = null; // ARES nedostupný – registraci nezablokujeme, IČO se uloží tak, jak bylo zadáno
    }
    if (company && !company.active) redirect(`${back}&chyba=${encodeURIComponent("Subjekt s tímto IČO podle ARES zanikl.")}`);
  }

  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get("email")).trim(),
    password,
    options: {
      data: {
        full_name: String(formData.get("full_name") || "").trim(),
        phone: String(formData.get("phone") || "").trim() || null,
        terms_accepted_at: new Date().toISOString(),
        terms_version: LEGAL_VALID_FROM,
        ...(isProvider && {
          ico: company?.ico ?? String(formData.get("ico") || "").replace(/\s/g, ""),
          company_name: String(formData.get("company_name") || "").trim() || company?.name,
          address: String(formData.get("address") || "").trim() || company?.address,
          city: company?.city ?? String(formData.get("city") || ""),
          region_name: company?.regionName ?? null,
        }),
      },
      emailRedirectTo: `${SITE_URL}/auth/callback?dalsi=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    const m = error.message.toLowerCase();
    const msg = m.includes("registered") ? "Tento e-mail už je zaregistrovaný. Zkuste se přihlásit."
      : m.includes("rate limit") ? "Příliš mnoho registrací za krátkou dobu. Zkuste to prosím za chvíli."
      : m.includes("signups") && m.includes("disabled") ? "Registrace je dočasně vypnutá."
      : m.includes("password") ? "Heslo je příliš slabé, zvolte delší nebo složitější."
      : m.includes("email") && m.includes("invalid") ? "E-mail nemá správný tvar."
      : "Registrace se nepovedla. Zkuste to znovu.";
    redirect(`${back}&chyba=${encodeURIComponent(msg)}`);
  }
  // Pokud je v Supabase zapnuté potvrzení e-mailu, session ještě není
  if (!data.session) redirect(`/prihlaseni?ok=${encodeURIComponent("Poslali jsme vám e-mail. Klikněte na odkaz a registrace bude dokončena.")}`);
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
