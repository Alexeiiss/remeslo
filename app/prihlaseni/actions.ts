"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { SITE_URL } from "@/lib/config";

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

  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get("email")).trim(),
    password,
    options: {
      data: {
        full_name: String(formData.get("full_name") || "").trim(),
        phone: String(formData.get("phone") || "").trim() || null,
      },
      emailRedirectTo: `${SITE_URL}/auth/callback?dalsi=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    const msg = error.message.includes("registered") ? "Tento e-mail už je zaregistrovaný." : "Registrace se nepovedla. Zkuste to znovu.";
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
