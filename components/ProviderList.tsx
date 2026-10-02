import Link from "next/link";
import { createPublicClient } from "@/lib/supabase";
import Avatar, { avatarUrl } from "./Avatar";

/** Seznam řemeslníků v oboru (a volitelně kraji), seřazený podle hodnocení */
export default async function ProviderList({ categoryId, regionId, title }: {
  categoryId: number; regionId?: number; title: string;
}) {
  const db = createPublicClient();
  const { data: inCat } = await db.from("provider_categories").select("provider_id").eq("category_id", categoryId);
  let ids = (inCat ?? []).map((x) => x.provider_id);
  if (regionId && ids.length) {
    const { data: inReg } = await db.from("provider_regions").select("provider_id").eq("region_id", regionId).in("provider_id", ids);
    ids = (inReg ?? []).map((x) => x.provider_id);
  }
  if (!ids.length) {
    return (
      <section className="card">
        <h2>{title}</h2>
        <p className="muted" style={{ margin: 0 }}>Zatím tu nikdo není. Zadejte poptávku. Rozešleme ji řemeslníkům, jakmile se zaregistrují.</p>
      </section>
    );
  }
  const { data: providers } = await db.from("provider_profiles")
    .select("user_id, company_name, city, rating_avg, rating_count, description, avatar_path")
    .in("user_id", ids.slice(0, 200))
    .order("rating_count", { ascending: false })
    .order("rating_avg", { ascending: false, nullsFirst: false })
    .limit(30);

  return (
    <section className="stack">
      <h2>{title}</h2>
      {providers?.map((p) => (
        <Link key={p.user_id} href={`/firma/${p.user_id}`} className="card" style={{ display: "flex", gap: 14, textDecoration: "none", color: "inherit" }}>
          <Avatar url={avatarUrl(p.avatar_path)} name={p.company_name} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row between">
            <strong>{p.company_name}</strong>
            <span className="small">
              {p.rating_count
                ? <><span style={{ color: "var(--accent)" }}>★ {Number(p.rating_avg).toFixed(1)}</span> <span className="muted">({p.rating_count})</span></>
                : <span className="muted">nový</span>}
            </span>
          </div>
          {p.city && <div className="small muted">{p.city}</div>}
          {p.description && <p className="small" style={{ margin: "6px 0 0" }}>{p.description.slice(0, 160)}{p.description.length > 160 ? "…" : ""}</p>}
          </div>
        </Link>
      ))}
    </section>
  );
}
