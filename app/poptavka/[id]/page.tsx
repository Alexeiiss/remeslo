import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { requireMe } from "@/lib/session";
import ConfirmButton from "@/components/ConfirmButton";
import {
  czk, date, dateTime, JOB_SIZE_LABEL, OFFER_STATUS_LABEL, REQUEST_STATUS_LABEL,
} from "@/lib/config";
import { cancelRequest, placeOffer, replyReview, selectOffer, submitReview, withdrawOffer } from "./actions";

type Review = {
  id: string; provider_id: string; rating: number; comment: string | null;
  reply: string | null; created_at: string;
};

const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

function ReviewView({ review, providerName }: { review: Review; providerName?: string }) {
  return (
    <div>
      <div style={{ color: "var(--accent)", fontSize: "1.3rem", letterSpacing: 2 }}>{stars(review.rating)}</div>
      {review.comment && <p style={{ whiteSpace: "pre-wrap", margin: "6px 0" }}>„{review.comment}“</p>}
      <div className="small muted">{date(review.created_at)}</div>
      {review.reply && (
        <div style={{ borderLeft: "3px solid var(--line)", paddingLeft: 12, marginTop: 10 }}>
          <div className="small muted">Odpověď{providerName ? ` – ${providerName}` : " řemeslníka"}:</div>
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{review.reply}</p>
        </div>
      )}
    </div>
  );
}

const RATING_OPTIONS = [
  [5, "výborné"], [4, "velmi dobré"], [3, "průměrné"], [2, "špatné"], [1, "velmi špatné"],
] as const;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chyba?: string; ok?: string; nova?: string }>;
};

export default async function RequestPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await requireMe(`/poptavka/${id}`);
  const supabase = await createClient();

  // RLS pustí jen zákazníka, řemeslníky z oboru (u otevřené) a ty, kdo nabízeli
  const { data: r } = await supabase
    .from("job_requests")
    .select("*, categories(name), regions(name)")
    .eq("id", id)
    .maybeSingle();
  if (!r) notFound();

  const isCustomer = r.customer_id === me.id;
  const { data: photoRows } = await supabase.from("request_photos").select("storage_path").eq("request_id", id);
  const { data: signed } = photoRows?.length
    ? await supabase.storage.from("request-photos").createSignedUrls(photoRows.map((p) => p.storage_path), 3600)
    : { data: [] as { signedUrl: string }[] };

  const { data: contacts } = r.status === "assigned"
    ? await supabase.rpc("get_contacts", { p_request_id: id })
    : { data: null };

  const { data: review } = r.status === "assigned"
    ? await supabase.from("reviews").select("*").eq("request_id", id).maybeSingle()
    : { data: null };

  return (
    <main className="container stack" style={{ maxWidth: 860 }}>
      {sp.nova && <div className="alert ok">Poptávka je zveřejněná. Řemeslníkům z vašeho kraje jsme poslali upozornění. O nových nabídkách vám dáme vědět e-mailem.</div>}
      {sp.ok && <div className="alert ok">{sp.ok}</div>}
      {sp.chyba && <div className="alert error">{sp.chyba}</div>}

      {/* Detail poptávky */}
      <div className="card">
        <div className="row between">
          <span className="muted small">{r.categories?.name} · {r.city}, {r.regions?.name}</span>
          <span className={`badge ${r.status}`}>{REQUEST_STATUS_LABEL[r.status]}</span>
        </div>
        <h1 style={{ marginTop: 8 }}>{r.title}</h1>
        <p style={{ whiteSpace: "pre-wrap" }}>{r.description}</p>
        {!!signed?.length && (
          <div className="photos" style={{ marginBottom: 16 }}>
            {signed.map((s, i) => s.signedUrl && (
              <a key={i} href={s.signedUrl} target="_blank" rel="noreferrer"><img src={s.signedUrl} alt={`Fotka ${i + 1}`} /></a>
            ))}
          </div>
        )}
        <div className="row small muted">
          <span>Velikost: <strong>{JOB_SIZE_LABEL[r.size]}</strong></span>
          {r.preferred_start && <span>· Začátek: <strong>{r.preferred_start}</strong></span>}
          <span>· Zadáno {date(r.created_at)}</span>
          {r.status === "open" && <span>· Nabídky: <strong>{r.offers_count} / {r.max_offers}</strong></span>}
        </div>
      </div>

      {/* Kontakty po výběru */}
      {!!contacts?.length && (
        <div className="card promise">
          <h2>Kontakty</h2>
          <div className="grid grid-2">
            {contacts.map((c: { role: string; name: string; email: string; phone: string }) => (
              <div key={c.role}>
                <div className="small muted">{c.role === "customer" ? "Zákazník" : "Řemeslník"}</div>
                <strong>{c.name}</strong>
                <div><a href={`tel:${c.phone}`}>{c.phone}</a></div>
                <div><a href={`mailto:${c.email}`}>{c.email}</a></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isCustomer
        ? <CustomerView request={r} review={review as Review | null} />
        : <ProviderView request={r} meId={me.id} isProvider={me.isProvider} review={review as Review | null} />}
    </main>
  );
}

/* ------------------------- Pohled zákazníka ------------------------- */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function CustomerView({ request: r, review }: { request: any; review: Review | null }) {
  const supabase = await createClient();
  const { data: offers } = await supabase
    .from("offers")
    .select("id, provider_id, price_czk, start_date, message, status, created_at, provider_profiles(company_name, city, rating_avg, rating_count, ico)")
    .eq("request_id", r.id)
    .neq("status", "withdrawn")
    .order("price_czk");

  // Poslední hodnocení řemeslníků, kteří nabízejí – pomůže zákazníkovi vybrat
  const providerIds = (offers ?? []).map((o) => o.provider_id);
  const { data: pastReviews } = providerIds.length && r.status === "open"
    ? await supabase.from("reviews").select("*").in("provider_id", providerIds)
        .not("comment", "is", null).order("created_at", { ascending: false }).limit(30)
    : { data: [] as Review[] };
  const reviewsOf = (pid: string) => (pastReviews ?? []).filter((x) => x.provider_id === pid).slice(0, 2);
  const selectedName = (offers ?? []).find((o) => o.status === "selected")?.provider_profiles as unknown as { company_name: string } | undefined;

  return (
    <section className="stack">
      {r.status === "assigned" && (
        <div className="card">
          <h2>{review ? "Vaše hodnocení" : "Ohodnoťte řemeslníka"}</h2>
          {review ? <ReviewView review={review} providerName={selectedName?.company_name} /> : (
            <form action={submitReview}>
              <input type="hidden" name="request_id" value={r.id} />
              <p className="muted">Až bude práce hotová, dejte vědět ostatním, jak to dopadlo. Hodnocení je veřejné.</p>
              <div className="field">
                {RATING_OPTIONS.map(([n, label]) => (
                  <label key={n} style={{ fontWeight: 400, display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                    <input type="radio" name="rating" value={n} required />
                    <span style={{ color: "var(--accent)", fontSize: "1.2rem", letterSpacing: 2 }}>{stars(n)}</span>
                    <span className="muted">{label}</span>
                  </label>
                ))}
              </div>
              <div className="field">
                <label>Komentář <span className="hint">(nepovinné)</span></label>
                <textarea name="comment" maxLength={2000} placeholder="Jak probíhala spolupráce, dodržel termín a cenu, kvalita práce…" />
              </div>
              <button className="btn accent">Odeslat hodnocení</button>
            </form>
          )}
        </div>
      )}

      <h2>Nabídky ({offers?.length ?? 0})</h2>
      {!offers?.length && (
        <div className="card muted">Zatím žádná nabídka. Řemeslníci obvykle reagují během 1–2 dnů. Dáme vám vědět e-mailem.</div>
      )}
      {offers?.map((o) => {
        const p = o.provider_profiles as unknown as { company_name: string; city: string | null; rating_avg: number | null; rating_count: number; ico: string | null };
        return (
          <div key={o.id} className="card">
            <div className="row between">
              <div>
                <h3 style={{ margin: 0 }}>{p.company_name}</h3>
                <div className="small muted">
                  {p.city}{p.ico && ` · IČO ${p.ico}`} ·{" "}
                  {p.rating_count ? `★ ${Number(p.rating_avg).toFixed(1)} (${p.rating_count})` : "zatím bez hodnocení"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="big">{czk(o.price_czk)}</div>
                {o.start_date && <div className="small muted">Může začít {date(o.start_date)}</div>}
              </div>
            </div>
            <p style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>{o.message}</p>
            {reviewsOf(o.provider_id).length > 0 && (
              <div className="stack small" style={{ background: "var(--bg)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <strong>Co o něm píšou zákazníci</strong>
                {reviewsOf(o.provider_id).map((rv) => (
                  <div key={rv.id}>
                    <span style={{ color: "var(--accent)" }}>{stars(rv.rating)}</span> „{rv.comment}“
                  </div>
                ))}
              </div>
            )}
            {o.status === "selected" && <span className="badge selected">Vybraný řemeslník</span>}
            {r.status === "open" && o.status === "pending" && (
              <form action={selectOffer}>
                <input type="hidden" name="request_id" value={r.id} />
                <input type="hidden" name="offer_id" value={o.id} />
                <ConfirmButton message={`Vybrat ${p.company_name}? Řemeslník uvidí váš kontakt a ostatní nabídky se uzavřou.`}>
                  Vybrat tohoto řemeslníka
                </ConfirmButton>
              </form>
            )}
          </div>
        );
      })}

      {r.status === "open" && (
        <form action={cancelRequest}>
          <input type="hidden" name="request_id" value={r.id} />
          <ConfirmButton className="btn danger" message="Opravdu zrušit poptávku? Všechny nabídky se uzavřou.">
            Zrušit poptávku
          </ConfirmButton>
        </form>
      )}
    </section>
  );
}

/* ------------------------- Pohled řemeslníka ------------------------- */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ProviderView({ request: r, meId, isProvider, review }: { request: any; meId: string; isProvider: boolean; review: Review | null }) {
  if (!isProvider) {
    return <div className="card">Na poptávky mohou odpovídat jen řemeslníci. <Link href="/remeslnik/profil">Vyplnit řemeslnický profil</Link></div>;
  }
  const supabase = await createClient();
  const [{ data: myOffer }, { data: price }, { data: balance }] = await Promise.all([
    supabase.from("offers").select("*").eq("request_id", r.id).eq("provider_id", meId).maybeSingle(),
    supabase.from("job_size_prices").select("credits").eq("size", r.size).single(),
    supabase.from("provider_credit_balance").select("available, held").eq("provider_id", meId).single(),
  ]);

  if (myOffer) {
    return (
      <div className="card">
        <div className="row between">
          <h2 style={{ margin: 0 }}>Vaše nabídka</h2>
          <span className={`badge ${myOffer.status}`}>{OFFER_STATUS_LABEL[myOffer.status]}</span>
        </div>
        <p className="big" style={{ marginTop: 12 }}>{czk(myOffer.price_czk)}</p>
        <p style={{ whiteSpace: "pre-wrap" }}>{myOffer.message}</p>
        <p className="small muted">
          Odesláno {dateTime(myOffer.created_at)} ·{" "}
          {myOffer.status === "pending" && `${myOffer.credits_cost} kreditů zablokováno`}
          {myOffer.status === "selected" && `${myOffer.credits_cost} kreditů strženo`}
          {(myOffer.status === "rejected" || myOffer.status === "withdrawn") && `${myOffer.credits_cost} kreditů vráceno`}
        </p>
        {myOffer.status === "pending" && (
          <form action={withdrawOffer}>
            <input type="hidden" name="request_id" value={r.id} />
            <input type="hidden" name="offer_id" value={myOffer.id} />
            <ConfirmButton className="btn secondary" message="Stáhnout nabídku? Kredity se vám vrátí.">Stáhnout nabídku</ConfirmButton>
          </form>
        )}
        {myOffer.status === "selected" && (
          <div style={{ borderTop: "1px solid var(--line)", marginTop: 16, paddingTop: 16 }}>
            <h3>Hodnocení od zákazníka</h3>
            {!review ? (
              <p className="muted small">Zákazník zatím nehodnotil. Hodnotit může, až bude práce hotová.</p>
            ) : (
              <>
                <ReviewView review={review} providerName="vy" />
                {!review.reply && (
                  <form action={replyReview} style={{ marginTop: 12 }}>
                    <input type="hidden" name="request_id" value={r.id} />
                    <input type="hidden" name="review_id" value={review.id} />
                    <div className="field">
                      <label>Vaše odpověď <span className="hint">(veřejná, jde napsat jen jednou)</span></label>
                      <textarea name="reply" required maxLength={2000} style={{ minHeight: 80 }} />
                    </div>
                    <button className="btn secondary">Odpovědět</button>
                  </form>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  if (r.status !== "open") return <div className="card muted">Tato poptávka je už uzavřená.</div>;
  if (r.offers_count >= r.max_offers) return <div className="card muted">Poptávka už má maximální počet nabídek.</div>;

  const cost = price?.credits ?? 0;
  const available = balance?.available ?? 0;
  const enough = available >= cost;

  return (
    <div className="card">
      <h2>Poslat nabídku</h2>
      <div className="alert info">
        Za nabídku se zablokuje <strong>{cost} kreditů</strong> (máte k dispozici {available}).
        Strhnou se <strong>jen pokud si vás zákazník vybere</strong>. Jinak se vrátí.
      </div>
      {!enough ? (
        <p>Nemáte dost kreditů. <Link href="/remeslnik/kredity" className="btn accent">Dobít kredity</Link></p>
      ) : (
        <form action={placeOffer}>
          <input type="hidden" name="request_id" value={r.id} />
          <div className="grid grid-2">
            <div className="field"><label>Cena (Kč vč. materiálu)</label><input type="number" name="price_czk" min={1} step={1} required /></div>
            <div className="field"><label>Mohu začít</label><input type="date" name="start_date" /></div>
          </div>
          <div className="field">
            <label>Zpráva zákazníkovi</label>
            <textarea name="message" required minLength={10} maxLength={3000} placeholder="Co je v ceně, jak budete postupovat, vaše zkušenosti…" />
            <div className="hint">Kontakt zatím nepište – zákazník ho dostane automaticky, až si vás vybere.</div>
          </div>
          <button className="btn accent">Odeslat nabídku ({cost} kreditů zablokovat)</button>
        </form>
      )}
    </div>
  );
}
