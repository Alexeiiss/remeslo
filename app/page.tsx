import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default async function Home() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories").select("slug, name").is("parent_id", null).order("sort_order");

  return (
    <>
      <section className="hero">
        <div className="container">
          <h1>Najděte šikovného řemeslníka. Zdarma a bez obvolávání.</h1>
          <p>Popište, co potřebujete, a dostanete až 4 nabídky od řemeslníků z vašeho kraje. Vyberete si podle ceny, termínu a hodnocení.</p>
          <div className="row" style={{ marginTop: 24 }}>
            <Link href="/poptavka/nova" className="btn accent">Zadat poptávku zdarma</Link>
            <Link href="/cenik" className="btn secondary">Jsem řemeslník</Link>
          </div>
        </div>
      </section>

      <main className="container stack">
        <section>
          <h2>Jak to funguje</h2>
          <div className="grid grid-3 steps">
            <div className="step"><h3>Zadáte poptávku</h3><p className="muted">Popis práce, místo a fotky. Váš kontakt zůstane skrytý.</p></div>
            <div className="step"><h3>Dostanete nabídky</h3><p className="muted">Maximálně 4 řemeslníci vám pošlou cenu a termín.</p></div>
            <div className="step"><h3>Vyberete jednoho</h3><p className="muted">Teprve vybraný řemeslník uvidí váš kontakt. Ostatní vás neotravují.</p></div>
          </div>
        </section>

        <section>
          <h2>Co potřebujete udělat?</h2>
          <div className="grid grid-3">
            {categories?.map((c) => (
              <Link key={c.slug} href={`/remeslnici/${c.slug}`} className="cat">{c.name}</Link>
            ))}
          </div>
        </section>

        <section className="card promise">
          <h2>Řemeslníci platí jen za zakázky, které opravdu získají</h2>
          <p>Kredity se při nabídce jen zablokují. Strhnou se pouze řemeslníkovi, kterého si zákazník vybere. Ostatním se okamžitě vrátí.</p>
          <Link href="/cenik">Ceník a podmínky pro řemeslníky →</Link>
        </section>
      </main>
    </>
  );
}
