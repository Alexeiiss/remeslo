import Link from "next/link";
import { createClient } from "@/lib/supabase";

const FAQ: [string, string][] = [
  ["Kolik zadání poptávky stojí?", "Nic. Pro zákazníky je portál zcela zdarma: zadání poptávky, nabídky i komunikace s řemeslníky."],
  ["Kolik nabídek dostanu?", "Nejvýš 4. Víc jich není potřeba a řemeslníci tak mají férovou šanci. Nehrozí, že vás bude obvolávat dvacet firem."],
  ["Kdo uvidí můj telefon a e-mail?", "Jen řemeslník, kterého si sami vyberete. Do té doby si píšete přes zprávy na portálu a kontakty v nich automaticky skrýváme."],
  ["Jak poznám, že je řemeslník spolehlivý?", "U každého vidíte hodnocení od zákazníků, kteří si ho přes portál opravdu vybrali, fotky jeho prací a IČO ověřené v obchodním rejstříku (ARES)."],
  ["Musím si někoho vybrat?", "Nemusíte. Když vám žádná nabídka nesedí, poptávku zrušte, nebo ji nechte po 30 dnech samu vypršet."],
  ["Jsem řemeslník. Za co platím?", "Jen za zakázky, které opravdu získáte. Kredity se při nabídce zablokují, a když si zákazník vybere jiného, vrátí se vám celé."],
];

export default async function Home() {
  const supabase = await createClient();
  const [{ data: categories }, { count: providers }] = await Promise.all([
    supabase.from("categories").select("slug, name").is("parent_id", null).order("sort_order"),
    supabase.from("provider_profiles").select("user_id", { count: "exact", head: true }),
  ]);

  return (
    <>
      <section className="hero">
        <div className="container">
          <h1>Najděte šikovného řemeslníka. Zdarma a bez obvolávání.</h1>
          <p>Popište, co potřebujete, a dostanete až 4 nabídky od řemeslníků z vašeho kraje. Vyberete si podle ceny, termínu a hodnocení.</p>

          <form action="/poptavka/nova" className="hero-search">
            <select name="obor" required defaultValue="" aria-label="Obor">
              <option value="" disabled>Co potřebujete udělat?</option>
              {categories?.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <button className="btn accent">Zadat poptávku zdarma</button>
          </form>

          <ul className="hero-points">
            <li>✓ Zdarma pro zákazníky</li>
            <li>✓ Max. 4 nabídky, žádné obtěžování</li>
            <li>✓ Telefon uvidí jen vybraný řemeslník</li>
            <li>✓ Ověřené IČO a skutečná hodnocení</li>
          </ul>
        </div>
      </section>

      <main className="container stack">
        <section>
          <h2>Jak to funguje</h2>
          <div className="grid grid-3 steps">
            <div className="step"><h3>Zadáte poptávku</h3><p className="muted">Popis práce, místo a klidně fotky nebo výkres. Zabere to 2 minuty.</p></div>
            <div className="step"><h3>Dostanete nabídky</h3><p className="muted">Až 4 řemeslníci vám pošlou cenu a termín. Doptat se můžete přes zprávy.</p></div>
            <div className="step"><h3>Vyberete jednoho</h3><p className="muted">Teprve vybraný řemeslník uvidí váš kontakt a ozve se vám. Ostatní vás neotravují.</p></div>
          </div>
        </section>

        <section>
          <h2>Řemeslníci podle oboru</h2>
          <div className="grid grid-3">
            {categories?.map((c) => (
              <Link key={c.slug} href={`/remeslnici/${c.slug}`} className="cat">{c.name}</Link>
            ))}
          </div>
        </section>

        <section className="card for-pros">
          <div className="grid grid-2" style={{ alignItems: "center" }}>
            <div>
              <span className="badge open">Pro řemeslníky</span>
              <h2 style={{ marginTop: 10 }}>Platíte jen za zakázky, které opravdu dostanete</h2>
              <p className="muted">Žádné placení za kontakty, které nikam nevedou. Kredity se při nabídce jen zablokují. Strhnou se, až když si vás zákazník vybere, jinak se vrátí celé.</p>
              <div className="row">
                <Link href="/prihlaseni?registrace=remeslnik" className="btn accent">Registrovat se zdarma</Link>
                <Link href="/cenik" className="btn secondary">Ceník</Link>
              </div>
            </div>
            <ul className="pro-list">
              <li><strong>Max. 4 konkurenti</strong><span>na jednu poptávku, ne třicet</span></li>
              <li><strong>Poptávky do e-mailu i na web</strong><span>jen z vašich oborů a krajů</span></li>
              <li><strong>Veřejný profil</strong><span>s fotkami prací a hodnoceními, který najde i Google</span></li>
              <li><strong>Kredity na start zdarma</strong><span>hned po registraci</span></li>
            </ul>
          </div>
        </section>

        <section>
          <h2>Časté otázky</h2>
          <div className="faq">
            {FAQ.map(([q, a]) => (
              <details key={q} className="card">
                <summary>{q}</summary>
                <p className="muted" style={{ margin: "10px 0 0" }}>{a}</p>
              </details>
            ))}
          </div>
        </section>

        {(providers ?? 0) >= 20 && (
          <p className="muted small" style={{ textAlign: "center" }}>Na portálu je zaregistrováno {providers} řemeslníků.</p>
        )}
      </main>
    </>
  );
}
