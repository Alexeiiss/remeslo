import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SITE_NAME } from "@/lib/config";
import { getMe } from "@/lib/session";
import { createClient } from "@/lib/supabase";
import Bell from "@/components/Bell";
import { OPERATOR } from "@/lib/legal";
import Logo from "@/components/Logo";
import { signOut } from "./prihlaseni/actions";

export const metadata: Metadata = {
  title: { default: `${SITE_NAME} – řemeslníci, kteří platí jen za získané zakázky`, template: `%s | ${SITE_NAME}` },
  description: "Zadejte poptávku zdarma a vyberte si z až 4 nabídek ověřených řemeslníků.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  const [first, ...rest] = SITE_NAME.split(".");
  let unread = 0;
  if (me) {
    const supabase = await createClient();
    const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
    unread = count ?? 0;
  }

  return (
    <html lang="cs">
      <body>
        <header className="header">
          <div className="container">
            <Link href="/" className="logo" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Logo />
              <span>{first}{rest.length > 0 && <span>.{rest.join(".")}</span>}</span>
            </Link>
            <nav className="nav">
              {!me && (
                <>
                  <Link href="/remeslnici">Najít řemeslníka</Link>
                  <Link href="/cenik">Pro řemeslníky</Link>
                  <Link href="/prihlaseni">Přihlásit</Link>
                  <Link href="/poptavka/nova" className="btn accent">Zadat poptávku</Link>
                </>
              )}
              {me && me.isProvider && (
                <>
                  <Link href="/remeslnik">Poptávky</Link>
                  <Link href="/remeslnik/kredity">Kredity</Link>
                  <Link href="/remeslnik/profil">Profil</Link>
                </>
              )}
              {me && !me.isProvider && (
                <>
                  <Link href="/moje-poptavky">Moje poptávky</Link>
                  <Link href="/poptavka/nova" className="btn accent">Zadat poptávku</Link>
                </>
              )}
              {me && me.role === "admin" && <Link href="/admin">Admin</Link>}
              {me && (
                <>
                  <Bell userId={me.id} initial={unread} />
                  <Link href="/ucet">Účet</Link>
                  <form action={signOut}><button className="link" type="submit">Odhlásit</button></form>
                </>
              )}
            </nav>
          </div>
        </header>
        {children}
        <footer className="footer">
          <div className="container stack">
            <div className="row between">
              <span>© {new Date().getFullYear()} {SITE_NAME}</span>
              <span className="row"><Link href="/remeslnici">Řemeslníci podle oboru</Link><Link href="/cenik">Ceník pro řemeslníky</Link></span>
            </div>
            <div className="row small" style={{ gap: 16 }}>
              <Link href="/obchodni-podminky">Obchodní podmínky</Link>
              <Link href="/ochrana-osobnich-udaju">Ochrana osobních údajů</Link>
              <Link href="/cookies">Cookies</Link>
              <span className="muted">Provozovatel: {OPERATOR.name}, IČO {OPERATOR.ico} · <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a></span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
