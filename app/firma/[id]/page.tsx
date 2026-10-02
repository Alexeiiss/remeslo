import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase";
import { date, SITE_NAME } from "@/lib/config";

export const revalidate = 600;

type Props = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f-]{36}$/i;

async function load(id: string) {
  if (!UUID.test(id)) return null;
  const db = createPublicClient();
  const { data: p } = await db.from("provider_profiles")
    .select("user_id, company_name, ico, description, city, rating_avg, rating_count, created_at")
    .eq("user_id", id).maybeSingle();
  if (!p) return null;
  const [{ data: cats }, { data: regs }, { data: photos }, { data: reviews }] = await Promise.all([
    db.from("provider_categories").select("categories(name, slug)").eq("provider_id", id),
    db.from("provider_regions").select("regions(name, slug)").eq("provider_id", id),
    db.from("provider_photos").select("id, storage_path").eq("provider_id", id).order("created_at", { ascending: false }),
    db.from("reviews").select("id, rating, comment, reply, created_at").eq("provider_id", id).order("created_at", { ascending: false }).limit(50),
  ]);
  return {
    p,
    cats: (cats ?? []).map((c) => c.categories as unknown as { name: string; slug: string }),
    regs: (regs ?? []).map((r) => r.regions as unknown as { name: string; slug: string }),
    photos: (photos ?? []).map((ph) => ({ id: ph.id, url: db.storage.from("provider-photos").getPublicUrl(ph.storage_path).data.publicUrl })),
    reviews: reviews ?? [],
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load((await params).id);
  if (!data) return { title: "Řemeslník nenalezen" };
  const { p, cats } = data;
  const rating = p.rating_count ? ` ★ ${Number(p.rating_avg).toFixed(1)} (${p.rating_count} hodnocení).` : "";
  return {
    title: `${p.company_name} – ${cats.map((c) => c.name).join(", ")}${p.city ? `, ${p.city}` : ""}`,
    description: `${p.company_name}${p.city ? ` (${p.city})` : ""}: ${cats.map((c) => c.name.toLowerCase()).join(", ")}.${rating} Pošlete poptávku zdarma na ${SITE_NAME}.`,
  };
}

const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

export default async function ProviderPublicPage({ params }: Props) {
  const data = await load((await params).id);
  if (!data) notFound();
  const { p, cats, regs, photos, reviews } = data;

  return (
    <main className="container stack" style={{ maxWidth: 900 }}>
      <div className="card">
        <h1 style={{ marginBottom: 4 }}>{p.company_name}</h1>
        <div className="muted">
          {p.city}{p.ico && ` · IČO ${p.ico}`} · na webu od {date(p.created_at)}
        </div>
        <div style={{ marginTop: 10, fontSize: "1.1rem" }}>
          {p.rating_count
            ? <><span style={{ color: "var(--accent)" }}>★ {Number(p.rating_avg).toFixed(1)}</span> <span className="muted">({p.rating_count} hodnocení)</span></>
            : <span className="muted">Zatím bez hodnocení</span>}
        </div>
        <div className="row" style={{ marginTop: 12, gap: 6 }}>
          {cats.map((c) => <Link key={c.slug} href={`/remeslnici/${c.slug}`} className="badge">{c.name}</Link>)}
        </div>
        <div className="small muted" style={{ marginTop: 8 }}>Působí: {regs.map((r) => r.name).join(", ")}</div>
        {p.description && <p style={{ whiteSpace: "pre-wrap", marginTop: 16 }}>{p.description}</p>}
        <Link href={`/poptavka/nova${cats[0] ? `?obor=${cats[0].slug}` : ""}`} className="btn accent">Zadat poptávku zdarma</Link>
      </div>

      {photos.length > 0 && (
        <section>
          <h2>Ukázky prací</h2>
          <div className="photos">
            {photos.map((ph) => (
              <a key={ph.id} href={ph.url} target="_blank" rel="noreferrer">
                <img src={ph.url} alt={`Práce – ${p.company_name}`} style={{ width: 200, height: 150 }} />
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="stack">
        <h2>Hodnocení zákazníků ({reviews.length})</h2>
        {!reviews.length && <div className="card muted">Tento řemeslník zatím nemá hodnocení.</div>}
        {reviews.map((rv) => (
          <div key={rv.id} className="card">
            <div className="row between">
              <span style={{ color: "var(--accent)", fontSize: "1.2rem", letterSpacing: 2 }}>{stars(rv.rating)}</span>
              <span className="small muted">{date(rv.created_at)}</span>
            </div>
            {rv.comment && <p style={{ whiteSpace: "pre-wrap", margin: "8px 0 0" }}>„{rv.comment}“</p>}
            {rv.reply && (
              <div style={{ borderLeft: "3px solid var(--line)", paddingLeft: 12, marginTop: 10 }}>
                <div className="small muted">Odpověď řemeslníka:</div>
                <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{rv.reply}</p>
              </div>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}
