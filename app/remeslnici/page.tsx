import type { Metadata } from "next";
import Link from "next/link";
import { createPublicClient } from "@/lib/supabase";
import { SITE_NAME } from "@/lib/config";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Řemeslníci podle oboru a kraje",
  description: `Najděte ověřené řemeslníky ve svém kraji – elektrikáře, instalatéry, zedníky a další. Poptávka zdarma na ${SITE_NAME}.`,
};

export default async function TradesIndex() {
  const db = createPublicClient();
  const { data: cats } = await db.from("categories").select("slug, name").order("sort_order");
  return (
    <main className="container stack">
      <h1>Řemeslníci podle oboru</h1>
      <p className="muted">Vyberte obor a kraj. Zadání poptávky je zdarma a dostanete až 4 nabídky.</p>
      <div className="grid grid-3">
        {cats?.map((c) => <Link key={c.slug} href={`/remeslnici/${c.slug}`} className="cat">{c.name}</Link>)}
      </div>
    </main>
  );
}
