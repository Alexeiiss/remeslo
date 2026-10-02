"use server";

import { createAdminClient, createClient } from "@/lib/supabase";
import { humanError, SITE_URL, JOB_SIZE_LABEL } from "@/lib/config";
import { sendEmail } from "@/lib/email";

export type CreateResult = { id: string } | { error: string } | { redirect: string };

/** Vytvoří poptávku. Přílohy pak nahraje prohlížeč přímo do úložiště a zavolá notifyNewRequest. */
export async function createRequest(formData: FormData): Promise<CreateResult> {
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("create_request", {
    p_category_id: Number(formData.get("category_id")),
    p_region_id: Number(formData.get("region_id")),
    p_city: String(formData.get("city") || ""),
    p_title: String(formData.get("title") || ""),
    p_description: String(formData.get("description") || ""),
    p_size: String(formData.get("size")),
    p_preferred_start: String(formData.get("preferred_start") || "") || null,
  });
  if (error) {
    if (error.message.includes("CHYBI_TELEFON")) {
      return { redirect: "/ucet?dalsi=/poptavka/nova&chyba=" + encodeURIComponent(humanError(error.message)) };
    }
    if (error.message.includes("check constraint")) return { error: "Zkontrolujte název (5–120 znaků) a popis (aspoň 20 znaků)." };
    return { error: humanError(error.message) };
  }
  return { id: id as string };
}

/**
 * Pošle e-mail řemeslníkům, kteří dělají daný obor v daném kraji.
 * Volá se po nahrání příloh; pro každou poptávku proběhne jen jednou.
 */
export async function notifyNewRequest(requestId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const admin = createAdminClient();

  // Označit jako odeslané – jen pokud je poptávka uživatele a ještě se neposílalo
  const { data: r } = await admin.from("job_requests")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", requestId).eq("customer_id", user.id).is("notified_at", null)
    .select("id, title, size, category_id, region_id").maybeSingle();
  if (!r) return;

  const [{ data: inCat }, { data: inReg }] = await Promise.all([
    admin.from("provider_categories").select("provider_id").eq("category_id", r.category_id),
    admin.from("provider_regions").select("provider_id").eq("region_id", r.region_id),
  ]);
  const regSet = new Set(inReg?.map((x) => x.provider_id));
  const ids = (inCat ?? []).map((x) => x.provider_id).filter((pid) => regSet.has(pid) && pid !== user.id);
  if (!ids.length) return;
  const { data: people } = await admin.from("profiles").select("email").in("id", ids);
  await Promise.all(
    (people ?? []).map((p) =>
      sendEmail(p.email, `Nová poptávka: ${r.title}`,
        `Ve vašem oboru a kraji je nová poptávka.\n\n${r.title}\nVelikost: ${JOB_SIZE_LABEL[r.size] ?? r.size}\n\nNa nabídky je místo jen pro 4 řemeslníky:\n${SITE_URL}/poptavka/${r.id}`),
    ),
  );
}
