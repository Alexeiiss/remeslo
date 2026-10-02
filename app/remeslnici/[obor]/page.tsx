import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase";
import { SITE_NAME } from "@/lib/config";
import ProviderList from "@/components/ProviderList";

export const revalidate = 3600;

type Props = { params: Promise<{ obor: string }> };

async function load(slug: string) {
  const db = createPublicClient();
  const { data: cat } = await db.from("categories").select("id, slug, name").eq("slug", slug).maybeSingle();
  if (!cat) return null;
  const { data: regions } = await db.from("regions").select("id, slug, name").order("name");
  return { cat, regions: regions ?? [] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load((await params).obor);
  if (!data) return {};
  return {
    title: `${data.cat.name} – ověření řemeslníci s hodnocením`,
    description: `Hledáte: ${data.cat.name.toLowerCase()}? Zadejte poptávku zdarma a dostanete až 4 nabídky od řemeslníků z vašeho kraje. ${SITE_NAME}`,
  };
}

export default async function TradePage({ params }: Props) {
  const data = await load((await params).obor);
  if (!data) notFound();
  const { cat, regions } = data;

  return (
    <main className="container stack">
      <div>
        <div className="small muted"><Link href="/remeslnici">Řemeslníci</Link> / {cat.name}</div>
        <h1>{cat.name}</h1>
        <p className="muted">Popište, co potřebujete, a během pár hodin dostanete nabídky. Vyberete si podle ceny, termínu a hodnocení ostatních zákazníků.</p>
        <Link href={`/poptavka/nova?obor=${cat.slug}`} className="btn accent">Zadat poptávku zdarma</Link>
      </div>

      <section>
        <h2>{cat.name} podle kraje</h2>
        <div className="grid grid-3">
          {regions.map((r) => <Link key={r.slug} href={`/remeslnici/${cat.slug}/${r.slug}`} className="cat">{r.name}</Link>)}
        </div>
      </section>

      <ProviderList categoryId={cat.id} title={`Nejlépe hodnocení – ${cat.name.toLowerCase()}`} />
    </main>
  );
}
