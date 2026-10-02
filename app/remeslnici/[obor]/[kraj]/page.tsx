import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase";
import { SITE_NAME } from "@/lib/config";
import ProviderList from "@/components/ProviderList";

export const revalidate = 3600;

type Props = { params: Promise<{ obor: string; kraj: string }> };

async function load(obor: string, kraj: string) {
  const db = createPublicClient();
  const [{ data: cat }, { data: region }] = await Promise.all([
    db.from("categories").select("id, slug, name").eq("slug", obor).maybeSingle(),
    db.from("regions").select("id, slug, name").eq("slug", kraj).maybeSingle(),
  ]);
  if (!cat || !region) return null;
  const { data: others } = await db.from("categories").select("slug, name").neq("slug", obor).order("sort_order");
  return { cat, region, others: others ?? [] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { obor, kraj } = await params;
  const data = await load(obor, kraj);
  if (!data) return {};
  return {
    title: `${data.cat.name} – ${data.region.name}`,
    description: `${data.cat.name}, ${data.region.name}: zadejte poptávku zdarma a porovnejte až 4 nabídky místních řemeslníků s hodnocením. ${SITE_NAME}`,
  };
}

export default async function TradeRegionPage({ params }: Props) {
  const { obor, kraj } = await params;
  const data = await load(obor, kraj);
  if (!data) notFound();
  const { cat, region, others } = data;

  return (
    <main className="container stack">
      <div>
        <div className="small muted">
          <Link href="/remeslnici">Řemeslníci</Link> / <Link href={`/remeslnici/${cat.slug}`}>{cat.name}</Link> / {region.name}
        </div>
        <h1>{cat.name} – {region.name}</h1>
        <p className="muted">
          Potřebujete řemeslníka ({region.name})? Zadejte poptávku zdarma.
          Ozvou se vám až 4 řemeslníci s cenou a termínem. Váš telefon uvidí jen ten, koho si vyberete.
        </p>
        <Link href={`/poptavka/nova?obor=${cat.slug}`} className="btn accent">Zadat poptávku zdarma</Link>
      </div>

      <ProviderList categoryId={cat.id} regionId={region.id} title={`Řemeslníci – ${region.name}`} />

      <section>
        <h2>Další obory – {region.name}</h2>
        <div className="grid grid-3">
          {others.map((c) => <Link key={c.slug} href={`/remeslnici/${c.slug}/${region.slug}`} className="cat">{c.name}</Link>)}
        </div>
      </section>
    </main>
  );
}
