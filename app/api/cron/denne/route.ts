import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/config";

// Denní úloha (Vercel Cron ji volá každé ráno, viz vercel.json):
//  1) propadlé poptávky uzavře a řemeslníkům vrátí kredity
//  2) zákazníkům, kteří po 14 dnech nikoho nevybrali, pošle připomínku
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("forbidden", { status: 403 });
  }
  const admin = createAdminClient();

  const { data: expired, error } = await admin.rpc("expire_requests");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Kredity starší než 12 měsíců propadnou
  const { data: creditsExpired, error: expErr } = await admin.rpc("expire_credits");
  if (expErr) console.error("[cron] expire_credits", expErr.message);

  const { data: days } = await admin.from("settings").select("value").eq("key", "reminder_after_days").single();
  const cutoff = new Date(Date.now() - Number(days?.value ?? 14) * 86400_000).toISOString();
  const { data: toRemind } = await admin
    .from("job_requests")
    .select("id, title, offers_count, profiles!job_requests_customer_id_fkey(email)")
    .eq("status", "open").lt("created_at", cutoff).is("reminder_sent_at", null).gt("offers_count", 0);

  for (const r of toRemind ?? []) {
    const email = (r.profiles as unknown as { email: string } | null)?.email;
    await sendEmail(email, `Máte ${r.offers_count} nabídky: ${r.title}`,
      `Na vaši poptávku čekají nabídky od řemeslníků. Vyberte si prosím jednoho, nebo poptávku zrušte, ať je řemeslníci nemusí držet:\n${SITE_URL}/poptavka/${r.id}`);
    await admin.from("job_requests").update({ reminder_sent_at: new Date().toISOString() }).eq("id", r.id);
  }

  return NextResponse.json({ expired, creditsExpired, reminded: toRemind?.length ?? 0 });
}
