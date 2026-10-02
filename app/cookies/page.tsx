import Link from "next/link";
import { OPERATOR, LEGAL_VALID_FROM } from "@/lib/legal";

export const metadata = { title: "Cookies" };

export default function CookiesPage() {
  return (
    <main className="container legal" style={{ maxWidth: 820 }}>
      <h1>Cookies</h1>
      <p className="muted">Platné od {LEGAL_VALID_FROM}</p>

      <p>Cookies jsou malé soubory, které web ukládá do vašeho prohlížeče.</p>

      <h2>Jaké cookies používáme</h2>
      <p>Používáme <strong>pouze technicky nezbytné cookies</strong>, bez kterých by portál nefungoval:</p>
      <table>
        <thead><tr><th>Cookie</th><th>K čemu slouží</th><th>Platnost</th></tr></thead>
        <tbody>
          <tr><td><code>sb-…-auth-token</code></td><td>Udržuje vás přihlášené a chrání účet</td><td>do odhlášení, nejdéle týdny</td></tr>
        </tbody>
      </table>
      <p>Nepoužíváme analytické, reklamní ani sledovací cookies a vaše chování na webu nepředáváme reklamním sítím. Technicky nezbytné cookies podle zákona nevyžadují souhlas, proto se na webu nezobrazuje lišta se souhlasem.</p>
      <p>Pokud bychom v budoucnu přidali analytické nebo marketingové cookies, vyžádáme si předem váš souhlas a tuto stránku aktualizujeme.</p>

      <h2>Jak cookies smazat</h2>
      <p>Cookies můžete kdykoli smazat v nastavení prohlížeče. Po smazání budete odhlášeni.</p>

      <p>Více o zpracování údajů v <Link href="/ochrana-osobnich-udaju">Zásadách ochrany osobních údajů</Link>. Dotazy na <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>.</p>
    </main>
  );
}
