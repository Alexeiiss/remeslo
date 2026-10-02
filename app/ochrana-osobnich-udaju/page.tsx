import Link from "next/link";
import { OPERATOR, LEGAL_VALID_FROM } from "@/lib/legal";
import { SITE_NAME } from "@/lib/config";

export const metadata = { title: "Ochrana osobních údajů" };

export default function PrivacyPage() {
  return (
    <main className="container legal" style={{ maxWidth: 820 }}>
      <h1>Zásady ochrany osobních údajů</h1>
      <p className="muted">Platné od {LEGAL_VALID_FROM}</p>

      <h2>1. Kdo vaše údaje zpracovává</h2>
      <p>Správcem osobních údajů je {OPERATOR.name}, IČO {OPERATOR.ico}, se sídlem {OPERATOR.address} (dále jen „správce“), provozovatel portálu {SITE_NAME}. Ve věcech osobních údajů nás kontaktujte na <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>.</p>

      <h2>2. Jaké údaje zpracováváme</h2>
      <ul>
        <li><strong>Údaje o účtu:</strong> jméno, e-mail, telefon, heslo (uložené pouze v zašifrované podobě).</li>
        <li><strong>Údaje řemeslníka:</strong> název firmy, IČO, adresa sídla (z veřejného registru ARES), město, obory a kraje působnosti, popis, profilová fotka a fotky prací.</li>
        <li><strong>Obsah, který vložíte:</strong> poptávky a jejich přílohy, nabídky, zprávy, hodnocení a odpovědi na ně.</li>
        <li><strong>Platební údaje:</strong> přehled nákupů kreditů a faktury. Údaje o platební kartě zpracovává výhradně platební brána Comgate, správce k nim nemá přístup.</li>
        <li><strong>Technické údaje:</strong> přihlašovací cookies a záznamy o přístupu (IP adresa, čas), nezbytné pro bezpečný provoz.</li>
      </ul>

      <h2>3. Proč a na jakém základě</h2>
      <table>
        <thead><tr><th>Účel</th><th>Právní základ</th></tr></thead>
        <tbody>
          <tr><td>Vedení účtu, zprostředkování poptávek a nabídek, předání kontaktu vybranému řemeslníkovi, zprávy, upozornění</td><td>plnění smlouvy (čl. 6 odst. 1 písm. b GDPR)</td></tr>
          <tr><td>Prodej kreditů, vystavení a archivace faktur</td><td>plnění smlouvy a právní povinnost (účetní a daňové předpisy)</td></tr>
          <tr><td>Ověření IČO řemeslníka, prevence podvodů a falešných poptávek, zabezpečení portálu, řešení reklamací a sporů</td><td>oprávněný zájem správce (čl. 6 odst. 1 písm. f GDPR)</td></tr>
          <tr><td>Veřejný profil řemeslníka a zveřejnění hodnocení</td><td>plnění smlouvy, u hodnocení oprávněný zájem na informování ostatních zákazníků</td></tr>
        </tbody>
      </table>
      <p>Nepoužíváme vaše údaje k automatizovanému rozhodování ani profilování s právními účinky a neposíláme reklamní sdělení bez vašeho souhlasu.</p>

      <h2>4. Kdo údaje uvidí</h2>
      <ul>
        <li><strong>Řemeslníci</strong> vidí obsah poptávek ve svém oboru (bez kontaktů zákazníka). Kontakt zákazníka dostane <strong>jen vybraný řemeslník</strong>, a zákazník zároveň dostane kontakt na něj.</li>
        <li><strong>Veřejnost</strong> vidí profil řemeslníka (název, město, IČO, obory, fotky) a hodnocení. Jména zákazníků se u hodnocení nezobrazují.</li>
        <li><strong>Zpracovatelé</strong>, kteří pro nás zajišťují technický provoz na základě smluv o zpracování:
          <ul>
            <li>Supabase Inc. – databáze, přihlašování a úložiště souborů (servery v EU, Irsko),</li>
            <li>Vercel Inc. – provoz webové aplikace (USA, předání na základě standardních smluvních doložek EU / EU-US Data Privacy Framework),</li>
            <li>Resend (Plus Five Five, Inc.) – odesílání e-mailů,</li>
            <li>Comgate, a.s. – platební brána,</li>
            <li>případně služba pro vystavování faktur a SMS brána, budou-li zapojeny.</li>
          </ul>
        </li>
        <li><strong>Orgány veřejné moci</strong>, pokud to vyžaduje zákon.</li>
      </ul>

      <h2>5. Jak dlouho údaje uchováváme</h2>
      <ul>
        <li>Údaje účtu a obsah po dobu existence účtu a následně 3 roky kvůli případným sporům.</li>
        <li>Faktury a účetní záznamy 10 let, jak ukládají daňové předpisy.</li>
        <li>Technické záznamy o přístupu nejvýše 12 měsíců.</li>
      </ul>

      <h2>6. Vaše práva</h2>
      <p>Máte právo na <strong>přístup</strong> ke svým údajům, jejich <strong>opravu</strong>, <strong>výmaz</strong>, <strong>omezení zpracování</strong>, <strong>přenositelnost</strong> a právo <strong>vznést námitku</strong> proti zpracování založenému na oprávněném zájmu. Žádost pošlete na <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>, vyřídíme ji nejpozději do 30 dnů.</p>
      <p>Pokud se domníváte, že údaje zpracováváme v rozporu s předpisy, můžete podat stížnost u Úřadu pro ochranu osobních údajů (<a href="https://uoou.gov.cz" target="_blank" rel="noreferrer">uoou.gov.cz</a>).</p>

      <h2>7. Cookies</h2>
      <p>Informace o cookies najdete na stránce <Link href="/cookies">Cookies</Link>.</p>
    </main>
  );
}
