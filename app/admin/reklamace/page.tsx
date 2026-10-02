import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase";
import { dateTime, humanError, SITE_URL } from "@/lib/config";
import { sendEmail } from "@/lib/email";
import { requireAdmin } from "@/lib/admin";

async function resolve(formData: FormData) {
  "use server";
  await requireAdmin();
  const supabase = await createClient();
  const approve = formData.get("decision") === "approve";
  const id = String(formData.get("dispute_id"));
  const { error } = await supabase.rpc("resolve_dispute", {
    p_dispute_id: id, p_approve: approve, p_note: String(formData.get("note") || ""),
  });
  if (error) redirect(`/admin/reklamace?chyba=${encodeURIComponent(humanError(error.message))}`);

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createAdminClient();
    const { data: d } = await admin.from("disputes").select("provider_id, offers(request_id)").eq("id", id).single();
    const { data: p } = await admin.from("profiles").select("email").eq("id", d!.provider_id).single();
    const requestId = (d?.offers as unknown as { request_id: string } | null)?.request_id;
    await sendEmail(p?.email, approve ? "Reklamace uznána – kredity vráceny" : "Reklamace zamítnuta",
      approve
        ? `Vaši reklamaci jsme uznali a kredity za zakázku jsme vám vrátili.\n${SITE_URL}/poptavka/${requestId}`
        : `Vaši reklamaci jsme posoudili a tentokrát ji nemůžeme uznat.${formData.get("note") ? `\n\nZdůvodnění: ${formData.get("note")}` : ""}\n${SITE_URL}/poptavka/${requestId}`);
  }
  revalidatePath("/admin/reklamace");
  redirect("/admin/reklamace?ok=1");
}

const STATUS: Record<string, string> = { open: "Čeká", approved: "Uznána", rejected: "Zamítnuta" };

export default async function DisputesPage({ searchParams }: { searchParams: Promise<{ chyba?: string; ok?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: list } = await supabase.from("disputes")
    .select("id, reason, status, admin_note, created_at, resolved_at, provider_id, provider_profiles(company_name), offers(credits_cost, price_czk, request_id, decided_at, job_requests(title, city))")
    .order("status").order("created_at", { ascending: false }).limit(100);

  return (
    <section className="stack">
      {sp.chyba && <div className="alert error">{sp.chyba}</div>}
      {sp.ok && <div className="alert ok">Uloženo, řemeslníkovi odešel e-mail.</div>}
      <h1>Reklamace</h1>
      {!list?.length && <div className="card muted">Zatím žádné reklamace.</div>}
      {list?.map((d) => {
        const o = d.offers as unknown as { credits_cost: number; request_id: string; job_requests: { title: string; city: string } };
        const pp = d.provider_profiles as unknown as { company_name: string };
        return (
          <div key={d.id} className="card">
            <div className="row between">
              <strong>{pp.company_name}</strong>
              <span className={`badge ${d.status === "open" ? "open" : d.status === "approved" ? "selected" : ""}`}>{STATUS[d.status]}</span>
            </div>
            <div className="small muted">
              Zakázka: <Link href={`/poptavka/${o.request_id}`}>{o.job_requests.title}</Link> ({o.job_requests.city}) · {o.credits_cost} kreditů · podáno {dateTime(d.created_at)}
            </div>
            <p style={{ whiteSpace: "pre-wrap" }}>{d.reason}</p>
            {d.admin_note && <p className="small">Vyjádření: {d.admin_note}</p>}
            {d.status === "open" && (
              <form action={resolve}>
                <input type="hidden" name="dispute_id" value={d.id} />
                <div className="field">
                  <label>Vyjádření pro řemeslníka <span className="hint">(nepovinné, pošle se e-mailem)</span></label>
                  <input type="text" name="note" />
                </div>
                <div className="row">
                  <button name="decision" value="approve" className="btn">Uznat a vrátit {o.credits_cost} kreditů</button>
                  <button name="decision" value="reject" className="btn danger">Zamítnout</button>
                </div>
              </form>
            )}
          </div>
        );
      })}
    </section>
  );
}
