"use server";

import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase";
import { humanError, SITE_URL, JOB_SIZE_LABEL } from "@/lib/config";
import { sendEmail } from "@/lib/email";

const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export async function createRequest(formData: FormData) {
  const supabase = await createClient();
  const back = (msg: string) => redirect(`/poptavka/nova?chyba=${encodeURIComponent(msg)}`);

  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (photos.length > MAX_PHOTOS) back(`Maximálně ${MAX_PHOTOS} fotek.`);
  if (photos.some((f) => f.size > MAX_PHOTO_BYTES)) back("Každá fotka může mít nejvýš 2 MB.");
  if (photos.some((f) => !f.type.startsWith("image/"))) back("Nahrávat lze jen obrázky.");

  const categoryId = Number(formData.get("category_id"));
  const regionId = Number(formData.get("region_id"));
  const title = String(formData.get("title") || "");

  const { data: id, error } = await supabase.rpc("create_request", {
    p_category_id: categoryId,
    p_region_id: regionId,
    p_city: String(formData.get("city") || ""),
    p_title: title,
    p_description: String(formData.get("description") || ""),
    p_size: String(formData.get("size")),
    p_preferred_start: String(formData.get("preferred_start") || "") || null,
  });
  if (error) {
    if (error.message.includes("CHYBI_TELEFON")) redirect("/ucet?dalsi=/poptavka/nova&chyba=" + encodeURIComponent(humanError(error.message)));
    if (error.message.includes("check constraint")) back("Zkontrolujte název (5–120 znaků) a popis (aspoň 20 znaků).");
    back(humanError(error.message));
  }

  // Fotky (chyba u fotky nezruší poptávku)
  for (const [i, file] of photos.entries()) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${id}/${i + 1}.${ext}`;
    const { error: upErr } = await supabase.storage.from("request-photos").upload(path, file, { contentType: file.type });
    if (!upErr) await supabase.from("request_photos").insert({ request_id: id, storage_path: path });
  }

  await notifyProviders(id as string, categoryId, regionId, title, String(formData.get("size")));
  redirect(`/poptavka/${id}?nova=1`);
}

/** Pošle e-mail řemeslníkům, kteří dělají daný obor v daném kraji */
async function notifyProviders(requestId: string, categoryId: number, regionId: number, title: string, size: string) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const admin = createAdminClient();
  const [{ data: inCat }, { data: inReg }] = await Promise.all([
    admin.from("provider_categories").select("provider_id").eq("category_id", categoryId),
    admin.from("provider_regions").select("provider_id").eq("region_id", regionId),
  ]);
  const regSet = new Set(inReg?.map((r) => r.provider_id));
  const ids = (inCat ?? []).map((r) => r.provider_id).filter((id) => regSet.has(id));
  if (!ids.length) return;
  const { data: people } = await admin.from("profiles").select("email").in("id", ids);
  await Promise.all(
    (people ?? []).map((p) =>
      sendEmail(p.email, `Nová poptávka: ${title}`,
        `Ve vašem oboru a kraji je nová poptávka.\n\n${title}\nVelikost: ${JOB_SIZE_LABEL[size] ?? size}\n\nNa nabídky je místo jen pro 4 řemeslníky:\n${SITE_URL}/poptavka/${requestId}`),
    ),
  );
}
