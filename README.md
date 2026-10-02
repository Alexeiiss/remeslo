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
3. Totéž postupně se soubory `002_storage.sql`, `003_reviews.sql`, `004_phase2.sql` a `005_avatar.sql`.
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

Test logiky: `npm run test:db` (spustí databázi v paměti a projde 68 scénářů).

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
