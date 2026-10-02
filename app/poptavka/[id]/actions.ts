"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase";
import { czk, humanError, SITE_URL } from "@/lib/config";
import { sendEmail } from "@/lib/email";

const back = (id: string, msg: string, kind: "chyba" | "ok" = "chyba") =>
  redirect(`/poptavka/${id}?${kind}=${encodeURIComponent(msg)}`);

const admin = () => (process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : null);

/** Skryje telefony a e-maily ve zprávě – kontakt se předává až po výběru */
function maskContacts(text: string) {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[kontakt skryt]")
    .replace(/(\+?\d[\d\s-]{7,}\d)/g, (m) => (m.replace(/\D/g, "").length >= 9 ? "[kontakt skryt]" : m));
}

async function emailOf(userId: string) {
  const a = admin();
  if (!a) return null;
  const { data } = await a.from("profiles").select("email").eq("id", userId).single();
  return data?.email ?? null;
}

/** Řemeslník posílá nabídku → kredity se zablokují */
export async function placeOffer(formData: FormData) {
  const requestId = String(formData.get("request_id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("place_offer", {
    p_request_id: requestId,
    p_price_czk: Math.round(Number(formData.get("price_czk"))),
    p_start_date: String(formData.get("start_date") || "") || null,
    p_message: maskContacts(String(formData.get("message") || "")),
  });
  if (error) {
    if (error.message.includes("check constraint")) back(requestId, "Zkontrolujte cenu a zprávu (aspoň 10 znaků).");
    back(requestId, humanError(error.message));
  }

  const a = admin();
  if (a) {
    const { data: r } = await a.from("job_requests").select("customer_id, title").eq("id", requestId).single();
    if (r) {
      await sendEmail(await emailOf(r.customer_id), `Nová nabídka: ${r.title}`,
        `Na vaši poptávku přišla nová nabídka (${czk(Number(formData.get("price_czk")))}).\n\nPorovnejte nabídky a vyberte řemeslníka:\n${SITE_URL}/poptavka/${requestId}`);
    }
  }
  revalidatePath(`/poptavka/${requestId}`);
  back(requestId, "Nabídka odeslána. Kredity jsou zablokované – strhnou se jen pokud si vás zákazník vybere.", "ok");
}

/** Řemeslník stáhne nabídku → kredity zpět */
export async function withdrawOffer(formData: FormData) {
  const requestId = String(formData.get("request_id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_offer", { p_offer_id: String(formData.get("offer_id")) });
  if (error) back(requestId, humanError(error.message));
  revalidatePath(`/poptavka/${requestId}`);
  back(requestId, "Nabídka stažena, kredity jsou zpět na vašem účtu.", "ok");
}

/** Zákazník vybírá → vybranému strhnout, ostatním vrátit */
export async function selectOffer(formData: FormData) {
  const requestId = String(formData.get("request_id"));
  const offerId = String(formData.get("offer_id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("select_offer", { p_offer_id: offerId });
  if (error) back(requestId, humanError(error.message));

  const a = admin();
  if (a) {
    const [{ data: r }, { data: offers }] = await Promise.all([
      a.from("job_requests").select("title").eq("id", requestId).single(),
      a.from("offers").select("id, provider_id, status").eq("request_id", requestId),
    ]);
    const link = `${SITE_URL}/poptavka/${requestId}`;
    await Promise.all((offers ?? []).map(async (o) => {
      const to = await emailOf(o.provider_id);
      if (o.id === offerId) {
        return sendEmail(to, `Zákazník si vás vybral: ${r?.title}`,
          `Gratulujeme, zakázka je vaše. Kontakt na zákazníka najdete zde:\n${link}`);
      }
      if (o.status === "rejected") {
        return sendEmail(to, `Zákazník vybral jiného řemeslníka: ${r?.title}`,
          `Tentokrát si zákazník vybral jinou nabídku. Zablokované kredity se vám vrátily na účet.`);
      }
    }));
  }
  revalidatePath(`/poptavka/${requestId}`);
  back(requestId, "Hotovo! Řemeslník uvidí váš kontakt a ozve se vám. Jeho kontakt máte níže.", "ok");
}

/** Zákazník ruší poptávku → všem vrátit */
export async function cancelRequest(formData: FormData) {
  const requestId = String(formData.get("request_id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_request", { p_request_id: requestId });
  if (error) back(requestId, humanError(error.message));
  revalidatePath("/moje-poptavky");
  redirect("/moje-poptavky?zrusena=1");
}
