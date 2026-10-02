# Řemeslo.cz (pracovní název) – fáze 1

Portál, kde zákazníci zadávají poptávky a řemeslníci posílají nabídky.
**Řemeslníci platí jen za zakázky, které opravdu získají:** kredity se při nabídce zablokují,
vybranému se strhnou, ostatním se vrátí.

## Co už funguje

| Část | Stav |
|---|---|
| Registrace a přihlášení (zákazník / řemeslník) | ✅ |
| Řemeslnický profil, obory, kraje, uvítací kredity | ✅ |
| Zadání poptávky s fotkami | ✅ |
| Max. 4 nabídky, kontakt skrytý do výběru | ✅ |
| Blokace → stržení vybranému → vrácení ostatním | ✅ otestováno |
| Stažení nabídky, zrušení poptávky, vypršení po 30 dnech | ✅ |
| Nákup kreditů přes Comgate | ✅ (ověřit v testovacím režimu) |
| E-maily (nová poptávka, nová nabídka, výběr, připomínka) | ✅ přes Resend |
| Denní úloha (vypršení, připomínky) | ✅ Vercel Cron |
| Hodnocení řemeslníků a odpovědi | ✅ fáze 2 |
| Zprávy zákazník ↔ řemeslník (kontakty skryté do výběru) | ✅ fáze 2 |
| Veřejný profil řemeslníka s profilovou fotkou a fotkami prací (`/firma/…`) | ✅ fáze 2 |
| SEO stránky obor × kraj (`/remeslnici/elektrikar/liberecky`), sitemap | ✅ fáze 2 |
| Reklamace kreditů + administrace (`/admin`) | ✅ fáze 2 |
| Expirace kreditů po 12 měsících | ✅ fáze 2 |

**Zbývá:** SMS ověření telefonu (potřebuje účet u SMS brány), faktury přes Fakturoid, ostrý Comgate,
e-maily z vlastní domény, obchodní podmínky a GDPR.

### Jak se stát administrátorem
V Supabase → SQL Editor spusťte (s vaším e-mailem):
```sql
update profiles set role = 'admin' where email = 'vas@email.cz';
```
Pak se v menu objeví odkaz **Admin**.



## Spuštění krok za krokem

### 1. Supabase (databáze, přihlašování, fotky)
1. Založte projekt na [supabase.com](https://supabase.com) (region Frankfurt).
2. **SQL Editor** → vložte celý soubor `supabase/migrations/001_schema.sql` → **Run**.
3. Totéž postupně se soubory `002_storage.sql`, `003_reviews.sql`, `004_phase2.sql`, `005_avatar.sql`, `006_ico_ares.sql`, `007_request_files.sql`, `008_notifications.sql`, `009_realtime.sql` a `010_sms_invoices.sql`.
4. **Authentication → URL Configuration:**
   - Site URL: `https://vasedomena.cz` (pro vývoj `http://localhost:3000`)
   - Redirect URLs: přidejte `https://vasedomena.cz/auth/callback` a `http://localhost:3000/auth/callback`
5. **Project Settings → API:** zkopírujte URL, `anon` klíč a `service_role` klíč.

### 2. Lokální spuštění
```bash
npm install
cp .env.example .env.local     # a vyplňte hodnoty
npm run dev                    # web běží na http://localhost:3000
```
Bez `RESEND_API_KEY` se e-maily jen vypisují do terminálu – pro vývoj stačí.

### 3. Comgate (platby)
1. Smlouva / testovací účet na [comgate.cz](https://www.comgate.cz).
2. V portálu Comgate → Integrace → nastavení obchodu:
   - **URL pro předání výsledku platby (notifikace):** `https://vasedomena.cz/api/platby/comgate`
   - **Návratové URL (zaplaceno / zrušeno / čeká):** `https://vasedomena.cz/platba/vysledek?id=${refId}`
   - Povolte IP adresu serveru, nebo vypněte omezení IP (Vercel nemá pevnou IP).
3. Do `.env.local` doplňte `COMGATE_MERCHANT_ID` a `COMGATE_SECRET`, nechte `COMGATE_TEST=true`.
4. Vyzkoušejte nákup testovací kartou. Až vše sedí, přepněte `COMGATE_TEST=false`.

> Kód používá Comgate API v1.0. Před ostrým spuštěním porovnejte parametry
> s aktuální dokumentací na [apidoc.comgate.cz](https://apidoc.comgate.cz).

### 4. Nasazení na Vercel
1. Nahrajte projekt na GitHub → na [vercel.com](https://vercel.com) **Add New Project**.
2. V **Environment Variables** vyplňte vše z `.env.example` (`NEXT_PUBLIC_SITE_URL` = vaše doména).
3. Denní úloha se nastaví sama ze souboru `vercel.json` (každý den v 6:00 UTC).

## Úpravy bez programování (v Supabase → Table Editor)
- **Ceny za zakázku:** tabulka `job_size_prices`
- **Balíčky kreditů:** tabulka `credit_packages`
- **Uvítací kredity, limit nabídek, délka poptávky:** tabulka `settings`
- **Obory:** tabulka `categories`

## Jak fungují kredity (technicky)
Každý pohyb je řádek v tabulce `credit_ledger` (nic se nepřepisuje ani nemaže):

| Událost | Záznam | Dostupné kredity |
|---|---|---|
| Nákup / bonus | `purchase` / `bonus` | + |
| Odeslání nabídky | `hold` | − cena |
| Zákazník vybral mě | `capture` | beze změny (kredity už jsou pryč) |
| Vybral jiného / zrušil / vypršelo / stáhl jsem | `release` | + cena zpět |

Veškerá logika je v databázových funkcích (`place_offer`, `select_offer`, `cancel_request`,
`expire_requests`, `confirm_payment`) a běží v transakcích – web nemůže kredity změnit napřímo.

Test logiky: `npm run test:db` (spustí databázi v paměti a projde 87 scénářů).

## Struktura
```
app/
  page.tsx                 úvod
  cenik/                   ceník pro řemeslníky
  prihlaseni/              přihlášení a registrace
  ucet/                    jméno a telefon
  poptavka/nova/           zadání poptávky
  poptavka/[id]/           detail: nabídky, výběr, odeslání nabídky
  moje-poptavky/           seznam pro zákazníka
  remeslnik/               přehled poptávek a nabídek řemeslníka
  remeslnik/profil/        obory, kraje, údaje firmy
  remeslnik/kredity/       zůstatek, nákup, historie
  platba/vysledek/         návrat z platební brány
  api/platby/comgate/      notifikace z Comgate
  api/cron/denne/          denní úloha
lib/                       Supabase, Comgate, e-maily, texty
supabase/migrations/       databáze
tests/                     test logiky kreditů
```

## Spuštění naostro

### SMS ověření telefonu
1. Účet u SMS brány podporované Supabase – nejjednodušší je **Twilio** (twilio.com): koupit/aktivovat
   odesílací číslo nebo Messaging Service, zkopírovat **Account SID**, **Auth Token** a **Messaging Service SID**.
2. Supabase → **Authentication → Sign In / Providers → Phone** → zapnout, SMS provider **Twilio**, vložit údaje → Save.
3. Vyzkoušet: **Účet → Ověření telefonu → Poslat ověřovací SMS**.
4. Až to funguje, zapnout povinné ověření: Supabase → **Table Editor → settings** →
   `require_phone_verification` přepsat na `1`. Pak půjde zadat poptávku jen s ověřeným telefonem.

### Comgate (platby)
1. Smlouva na **comgate.cz**. V portálu Comgate → Integrace → Nastavení obchodu:
   - URL pro předání výsledku platby: `https://VASEDOMENA/api/platby/comgate`
   - Návratové URL (zaplaceno / zrušeno / čeká): `https://VASEDOMENA/platba/vysledek?id=${refId}`
   - Povolit metodu „HTTP POST“ notifikace; omezení IP vypnout (Vercel nemá pevnou IP).
2. Vercel → Environment Variables: `COMGATE_MERCHANT_ID`, `COMGATE_SECRET`, `COMGATE_TEST=true` → Redeploy.
3. Vyzkoušet nákup testovací kartou, pak `COMGATE_TEST=false` → Redeploy.

### Fakturoid (faktury za kredity)
1. Účet na **fakturoid.cz** (pro odesílání faktur e-mailem z API je potřeba placený tarif).
2. Fakturoid → **Nastavení → Uživatelský účet → API** → vytvořit klíče (Client ID, Client Secret).
3. Vercel → Environment Variables: `FAKTUROID_SLUG` (z adresy app.fakturoid.cz/**slug**/…),
   `FAKTUROID_CLIENT_ID`, `FAKTUROID_CLIENT_SECRET`, `FAKTUROID_VAT_RATE` (21 plátce / 0 neplátce),
   `FAKTUROID_CONTACT_EMAIL` → Redeploy.
4. Po každé zaplacené platbě se automaticky vystaví faktura, označí se jako zaplacená a odešle se
   řemeslníkovi e-mailem. Odkaz na ni je v sekci **Kredity**.

### Vlastní doména
1. Koupit doménu (Wedos, Forpsi, Active24…).
2. Vercel → **Settings → Domains → Add** → zadat doménu; u registrátora nastavit DNS podle Vercelu
   (typicky záznam **A** `76.76.21.21` pro hlavní doménu a **CNAME** `www` → `cname.vercel-dns.com`).
3. Vercel → `NEXT_PUBLIC_SITE_URL=https://vasedomena.cz` → Redeploy.
4. Supabase → Authentication → URL Configuration → Site URL a Redirect URLs na novou doménu.
5. E-maily: Resend (ověřit doménu), Vercel `RESEND_API_KEY` + `EMAIL_FROM`, Supabase Custom SMTP,
   pak znovu zapnout **Confirm email**.
