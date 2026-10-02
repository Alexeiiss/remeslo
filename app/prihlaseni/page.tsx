import Link from "next/link";
import { signIn, signUp } from "./actions";

export const metadata = { title: "Přihlášení" };

type SP = Promise<{ chyba?: string; ok?: string; dalsi?: string; registrace?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const register = sp.registrace;
  const dalsi = sp.dalsi || "";

  return (
    <main className="container" style={{ maxWidth: 480 }}>
      {sp.chyba && <div className="alert error">{sp.chyba}</div>}
      {sp.ok && <div className="alert ok">{sp.ok}</div>}

      {!register ? (
        <div className="card">
          <h1>Přihlášení</h1>
          <form action={signIn}>
            <input type="hidden" name="dalsi" value={dalsi} />
            <div className="field"><label>E-mail</label><input type="email" name="email" required autoComplete="email" /></div>
            <div className="field"><label>Heslo</label><input type="password" name="password" required autoComplete="current-password" /></div>
            <button className="btn block">Přihlásit se</button>
          </form>
          <p className="small muted" style={{ marginTop: 16 }}>
            Nemáte účet?{" "}
            <Link href={`/prihlaseni?registrace=zakaznik&dalsi=${encodeURIComponent(dalsi)}`}>Registrace pro zákazníky</Link>
            {" · "}
            <Link href="/prihlaseni?registrace=remeslnik">pro řemeslníky</Link>
          </p>
        </div>
      ) : (
        <div className="card">
          <h1>{register === "remeslnik" ? "Registrace řemeslníka" : "Registrace"}</h1>
          {register === "remeslnik" && (
            <div className="alert info">Po registraci vyplníte profil (obory, kraje) a dostanete uvítací kredity.</div>
          )}
          <form action={signUp}>
            <input type="hidden" name="typ" value={register} />
            <input type="hidden" name="dalsi" value={dalsi} />
            <div className="field"><label>Jméno a příjmení</label><input type="text" name="full_name" required autoComplete="name" /></div>
            <div className="field"><label>E-mail</label><input type="email" name="email" required autoComplete="email" /></div>
            <div className="field">
              <label>Telefon</label>
              <input type="tel" name="phone" required autoComplete="tel" placeholder="+420 …" />
              <div className="hint">Uvidí ho jen řemeslník / zákazník, se kterým se domluvíte.</div>
            </div>
            <div className="field"><label>Heslo</label><input type="password" name="password" required minLength={8} autoComplete="new-password" /><div className="hint">Aspoň 8 znaků.</div></div>
            <button className="btn block">Zaregistrovat se</button>
          </form>
          <p className="small muted" style={{ marginTop: 16 }}>Už máte účet? <Link href="/prihlaseni">Přihlaste se</Link></p>
        </div>
      )}
    </main>
  );
}
