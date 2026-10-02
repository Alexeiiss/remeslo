import Link from "next/link";
import { OPERATOR, LEGAL_VALID_FROM } from "@/lib/legal";
import { SITE_NAME, SITE_URL } from "@/lib/config";

export const metadata = { title: "Obchodní podmínky" };

export default function TermsPage() {
  const site = SITE_NAME;
  return (
    <main className="container legal" style={{ maxWidth: 820 }}>
      <h1>Obchodní podmínky portálu {site}</h1>
      <p className="muted">Platné od {LEGAL_VALID_FROM}</p>

      <h2>1. Úvodní ustanovení</h2>
      <p>1.1 Tyto obchodní podmínky upravují používání internetového portálu {site} dostupného na adrese {SITE_URL} (dále jen „portál“).</p>
      <p>1.2 Provozovatelem portálu je {OPERATOR.name}, IČO {OPERATOR.ico}{OPERATOR.dic && `, DIČ ${OPERATOR.dic}`}, se sídlem {OPERATOR.address}, {OPERATOR.register} (dále jen „provozovatel“). Kontakt: {OPERATOR.email}, {OPERATOR.phone}.</p>
      <p>1.3 Pojmy:</p>
      <ul>
        <li><strong>Zákazník</strong> – kdokoli, kdo prostřednictvím portálu zadá poptávku na řemeslnou práci.</li>
        <li><strong>Řemeslník</strong> – podnikatel s platným IČO, který se na portálu zaregistroval za účelem získávání zakázek.</li>
        <li><strong>Poptávka</strong> – popis práce, kterou zákazník poptává, včetně případných příloh.</li>
        <li><strong>Nabídka</strong> – cena, termín a zpráva, kterou řemeslník zákazníkovi k poptávce zašle.</li>
        <li><strong>Kredit</strong> – zúčtovací jednotka portálu, kterou řemeslník platí za získané zakázky. 1 kredit odpovídá 1 Kč.</li>
      </ul>

      <h2>2. Role portálu</h2>
      <p>2.1 Portál zprostředkovává kontakt mezi zákazníky a řemeslníky. Provozovatel <strong>není stranou smlouvy</strong> o provedení práce. Smlouvu (o dílo apod.) uzavírá zákazník přímo s řemeslníkem a oni také odpovídají za její splnění, cenu, kvalitu a záruky.</p>
      <p>2.2 Provozovatel neodpovídá za kvalitu, včasnost ani cenu prací, za pravdivost údajů uvedených zákazníky a řemeslníky ani za škodu vzniklou v souvislosti se spoluprací mezi nimi. Provozovatel ověřuje existenci IČO řemeslníka ve veřejném registru ARES, neověřuje však jeho odbornou způsobilost.</p>

      <h2>3. Registrace a uživatelský účet</h2>
      <p>3.1 Uživatel je povinen uvádět pravdivé a aktuální údaje. Řemeslník se registruje s IČO, které portál ověří v registru ARES. Jedno IČO může mít na portálu pouze jeden řemeslnický účet.</p>
      <p>3.2 Uživatel odpovídá za utajení svého hesla a za činnosti provedené z jeho účtu.</p>
      <p>3.3 Uživatel může svůj účet kdykoli zrušit žádostí zaslanou na {OPERATOR.email}. Nevyužité kredity zrušením účtu propadají, pokud právní předpisy nestanoví jinak.</p>

      <h2>4. Podmínky pro zákazníky</h2>
      <p>4.1 Zadání poptávky i využívání portálu je pro zákazníky <strong>zdarma</strong>.</p>
      <p>4.2 Na jednu poptávku mohou nabídku zaslat nejvýše 4 řemeslníci. Kontaktní údaje zákazníka (jméno, telefon, e-mail) se předají <strong>pouze řemeslníkovi, kterého si zákazník vybere</strong>. Do té doby probíhá komunikace přes zprávy na portálu a telefonní čísla a e-maily v nich portál automaticky skrývá.</p>
      <p>4.3 Poptávka je otevřená 30 dní. Pokud zákazník do té doby nikoho nevybere, poptávka se automaticky uzavře. Zákazník může poptávku kdykoli zrušit.</p>
      <p>4.4 Zákazník se zavazuje zadávat pouze skutečné poptávky, které má v úmyslu realizovat, a nevybírat řemeslníka bez úmyslu s ním spolupracovat.</p>

      <h2>5. Podmínky pro řemeslníky – kredity</h2>
      <p>5.1 Prohlížení poptávek je zdarma. Při odeslání nabídky se řemeslníkovi na účtu <strong>zablokuje</strong> počet kreditů podle velikosti zakázky dle aktuálního <Link href="/cenik">ceníku</Link>.</p>
      <p>5.2 Pokud si zákazník řemeslníka vybere, zablokované kredity se <strong>strhnou</strong>. Tím je služba portálu (zprostředkování kontaktu) poskytnuta, bez ohledu na to, zda se zákazník a řemeslník následně dohodnou.</p>
      <p>5.3 Zablokované kredity se řemeslníkovi <strong>vrátí v plné výši</strong>, pokud (a) zákazník vybere jiného řemeslníka, (b) zákazník poptávku zruší, (c) poptávka vyprší bez výběru, nebo (d) řemeslník svou nabídku stáhne dříve, než zákazník vybere.</p>
      <p>5.4 Kredity se kupují v balíčcích dle ceníku, ceny jsou uvedeny včetně DPH, pokud ji provozovatel odvádí. Ke každému nákupu vystaví provozovatel daňový doklad. Provozovatel může ceník měnit. Změna se nedotkne kreditů již zablokovaných v odeslaných nabídkách.</p>
      <p>5.5 Kredity jsou platné <strong>12 měsíců</strong> od připsání na účet. Kredity se čerpají od nejstarších. Kredity, které nebyly do 12 měsíců využity, propadají bez náhrady.</p>
      <p>5.6 Uvítací a bonusové kredity poskytuje provozovatel bezplatně. Nelze je převést ani vyplatit.</p>
      <p>5.7 Kredity nejsou elektronickými penězi a nelze je směnit zpět za peníze, s výjimkou případů stanovených zákonem.</p>
      <p>5.8 Řemeslník kupuje kredity jako podnikatel v rámci své podnikatelské činnosti, a nevztahují se na něj proto ustanovení o odstoupení od smlouvy uzavřené spotřebitelem distančním způsobem.</p>

      <h2>6. Reklamace kreditů</h2>
      <p>6.1 Řemeslník může do <strong>30 dnů</strong> od výběru požádat o vrácení stržených kreditů, pokud zakázka neproběhla z důvodů na straně zákazníka (např. falešná poptávka, zákazník nereaguje, nepravdivé údaje). Žádost podává přímo u poptávky na portálu s popisem důvodu.</p>
      <p>6.2 O reklamaci rozhoduje provozovatel zpravidla do 30 dnů. Při uznání se kredity vrátí na účet řemeslníka. O výsledku je řemeslník informován.</p>

      <h2>7. Platby</h2>
      <p>7.1 Platby za kredity probíhají prostřednictvím platební brány Comgate, a.s. Údaje o platební kartě zpracovává výhradně platební brána, provozovatel k nim nemá přístup.</p>
      <p>7.2 Kredity se připíší na účet řemeslníka bezprostředně po potvrzení platby platební bránou.</p>

      <h2>8. Hodnocení</h2>
      <p>8.1 Řemeslníka může hodnotit <strong>pouze zákazník, který si ho přes portál vybral</strong>, a to jednou za každou zakázku. Hodnocení tak pochází od skutečných zákazníků portálu. Řemeslník může na hodnocení jednou veřejně odpovědět.</p>
      <p>8.2 Hodnocení musí být pravdivé a věcné. Provozovatel může odstranit hodnocení či odpověď, která obsahuje vulgarity, osobní údaje, nepravdivá tvrzení nebo jinak porušuje tyto podmínky. Hodnocení neupravuje ani je neodstraňuje kvůli tomu, že je negativní.</p>

      <h2>9. Pravidla chování</h2>
      <p>9.1 Je zakázáno zejména: zadávat falešné poptávky či nabídky, předávat kontaktní údaje dříve, než zákazník vybere řemeslníka, s cílem obejít platbu, vkládat nepravdivá hodnocení, vkládat obsah porušující právní předpisy nebo práva třetích osob, zasílat nevyžádaná obchodní sdělení a zasahovat do technického fungování portálu.</p>
      <p>9.2 Při porušení podmínek může provozovatel obsah odstranit, účet omezit nebo zrušit a odebrat kredity získané v rozporu s podmínkami.</p>

      <h2>10. Ochrana osobních údajů</h2>
      <p>Zpracování osobních údajů se řídí dokumentem <Link href="/ochrana-osobnich-udaju">Zásady ochrany osobních údajů</Link>. Informace o cookies najdete na stránce <Link href="/cookies">Cookies</Link>.</p>

      <h2>11. Změny podmínek</h2>
      <p>Provozovatel může tyto podmínky měnit. O změně informuje registrované uživatele e-mailem nebo na portálu nejméně 14 dní předem. Pokud uživatel se změnou nesouhlasí, může účet zrušit. Pokračováním v používání portálu po účinnosti změny vyjadřuje souhlas s novým zněním.</p>

      <h2>12. Řešení sporů a závěrečná ustanovení</h2>
      <p>12.1 Tyto podmínky a vztahy z nich vyplývající se řídí právem České republiky.</p>
      <p>12.2 Spotřebitel má právo na mimosoudní řešení sporu. Příslušným subjektem je Česká obchodní inspekce (<a href="https://adr.coi.cz" target="_blank" rel="noreferrer">adr.coi.cz</a>).</p>
      <p>12.3 Stížnosti a dotazy lze zasílat na {OPERATOR.email}.</p>
    </main>
  );
}
