import { PGlite } from "@electric-sql/pglite";
import fs from "fs";

const db = new PGlite();
const SQL = fs.readFileSync(new URL("../supabase/migrations/001_schema.sql", import.meta.url), "utf8");

await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
`);
await db.exec(SQL);
await db.exec(fs.readFileSync(new URL("../supabase/migrations/003_reviews.sql", import.meta.url), "utf8"));
await db.exec(fs.readFileSync(new URL("../supabase/migrations/004_phase2.sql", import.meta.url), "utf8")
  .split("-- ==================== STORAGE")[0]);
await db.exec(fs.readFileSync(new URL("../supabase/migrations/005_avatar.sql", import.meta.url), "utf8"));
await db.exec(fs.readFileSync(new URL("../supabase/migrations/006_ico_ares.sql", import.meta.url), "utf8"));
await db.exec(fs.readFileSync(new URL("../supabase/migrations/007_request_files.sql", import.meta.url), "utf8")
  .split("\n").filter((l) => !l.includes("storage.buckets")).join("\n"));
await db.exec(fs.readFileSync(new URL("../supabase/migrations/008_notifications.sql", import.meta.url), "utf8"));
await db.exec(`
  grant usage on schema public to authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated; grant usage on all sequences in schema public to authenticated;
  grant execute on all functions in schema public to authenticated;
  revoke execute on function confirm_payment(uuid, text) from authenticated;
`);

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log("  ✔", msg); } else { fail++; console.log("  ✘", msg); } };
const as = (uid) => db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ""]);
const one = async (q, p = []) => (await db.query(q, p)).rows[0];
const expectErr = async (fn, code, msg) => {
  try { await fn(); ok(false, `${msg} (čekal jsem chybu ${code})`); }
  catch (e) { ok(e.message.includes(code), `${msg} → ${code}`); }
};
const avail = async (uid) => (await one(`select credits_available($1) a`, [uid])).a;
const bal = async (uid) => one(`select available, held from provider_credit_balance where provider_id = $1`, [uid]);

const U = (n) => `00000000-0000-0000-0000-00000000000${n}`;
const C = U(1), P1 = U(2), P2 = U(3), P3 = U(4), P4 = U(5), P5 = U(6), PX = U(7), C2 = U(8);
for (const [id, phone] of [[C, "+420777000001"], [P1], [P2], [P3], [P4], [P5], [PX], [C2]]) {
  await db.query(`insert into auth.users values ($1, $2, $3)`,
    [id, `${id.slice(-1)}@test.cz`, JSON.stringify({ full_name: "Uživatel " + id.slice(-1), phone })]);
}
ok((await one(`select count(*)::int n from profiles`)).n === 8, "profily se vytvoří po registraci");

const elektro = (await one(`select id from categories where slug='elektrikar'`)).id;
const voda = (await one(`select id from categories where slug='instalater'`)).id;
const liberec = (await one(`select id from regions where slug='liberecky'`)).id;

console.log("\n1) Registrace řemeslníků");
for (const p of [P1, P2, P3, P4, P5]) {
  await as(p);
  await db.query(`select upsert_provider_profile($1,null,'Popis','Liberec',$2,$3)`,
    ["Firma " + p.slice(-1), [elektro], [liberec]]);
}
await as(PX);
await db.query(`select upsert_provider_profile('Instalatér s.r.o.',null,null,'Liberec',$1,$2)`, [[voda], [liberec]]);
ok(await avail(P1) === 200, "uvítací bonus 200 kreditů");
await as(P1);
await db.query(`select upsert_provider_profile('Firma 2 upr',null,null,'Liberec',$1,$2)`, [[elektro], [liberec]]);
ok(await avail(P1) === 200, "úprava profilu bonus nepřidá podruhé");
ok((await one(`select role from profiles where id=$1`, [P1])).role === "provider", "role změněna na řemeslníka");

console.log("\n2) Poptávka");
await as(C2);
await expectErr(() => db.query(`select create_request($1,$2,'Liberec','Výměna jističů','Potřebuji vyměnit staré jističe v bytě.','medium',null)`, [elektro, liberec]),
  "CHYBI_TELEFON", "poptávka bez telefonu nejde");
await as(C);
const R1 = (await one(`select create_request($1,$2,'Liberec','Nový rozvaděč v RD','Výměna starého rozvaděče za nový, rodinný dům 4+1.','medium','do měsíce') id`, [elektro, liberec])).id;
ok(!!R1, "zákazník zadal poptávku (střední = 150 kreditů)");

console.log("\n3) Nabídky → blokace kreditů");
const offer = async (p, req, price = 20000) => { await as(p); return (await one(`select place_offer($1,$2,current_date+7,'Dobrý den, rád to udělám.') id`, [req, price])).id; };
const O1 = await offer(P1, R1), O2 = await offer(P2, R1), O3 = await offer(P3, R1), O4 = await offer(P4, R1);
ok(await avail(P1) === 50, "P1: dostupné 200 − 150 = 50");
let b = await bal(P1); ok(b.held === 150, "P1: zablokováno 150");
await expectErr(() => offer(P5, R1), "PLNY_POCET_NABIDEK", "5. nabídka neprojde");
await expectErr(() => offer(PX, R1), "MIMO_VAS_OBOR", "řemeslník z jiného oboru nemůže nabízet");
await expectErr(() => offer(P1, R1), "NABIDKA_UZ_EXISTUJE", "dvojí nabídka na stejnou poptávku");
await as(C);
const R2 = (await one(`select create_request($1,$2,'Liberec','Elektroinstalace novostavba','Kompletní elektroinstalace v novostavbě RD.','large',null) id`, [elektro, liberec])).id;
await expectErr(() => offer(P1, R2), "NEDOSTATEK_KREDITU", "nabídka bez dostatku kreditů neprojde");

console.log("\n4) Stažení nabídky");
await as(P2); await db.query(`select withdraw_offer($1)`, [O2]);
ok(await avail(P2) === 200, "P2 stáhl nabídku → kredity zpět (200)");
ok((await one(`select offers_count from job_requests where id=$1`, [R1])).offers_count === 3, "místo pro další nabídku se uvolnilo");
const O5 = await offer(P5, R1);
ok(await avail(P5) === 50, "P5 teď může nabídnout");

console.log("\n5) Kontakty před výběrem");
await as(P1);
ok((await db.query(`select * from get_contacts($1)`, [R1])).rows.length === 0, "před výběrem řemeslník kontakt nevidí");

console.log("\n6) Zákazník vybere P1");
await as(P3);
await expectErr(() => db.query(`select select_offer($1)`, [O1]), "NENI_VASE_POPTAVKA", "cizí člověk nemůže vybírat");
await as(C); await db.query(`select select_offer($1)`, [O1]);
ok(await avail(P1) === 50 && (await bal(P1)).held === 0, "P1 (vybraný): 150 strženo, nic nevisí");
ok(await avail(P3) === 200 && await avail(P4) === 200 && await avail(P5) === 200, "P3, P4, P5: kredity vráceny (200)");
ok((await one(`select status from job_requests where id=$1`, [R1])).status === "assigned", "poptávka je přidělena");
const st = (await db.query(`select provider_id, status from offers where request_id=$1 order by provider_id`, [R1])).rows.map(r => r.status).join(",");
ok(st === "selected,withdrawn,rejected,rejected,rejected", "stavy nabídek: " + st);
await expectErr(() => db.query(`select select_offer($1)`, [O3]), "POPTAVKA_UZAVRENA", "nelze vybrat podruhé");
await as(P1);
ok((await db.query(`select * from get_contacts($1)`, [R1])).rows.length === 2, "vybraný řemeslník vidí kontakt zákazníka");
await as(P3);
ok((await db.query(`select * from get_contacts($1)`, [R1])).rows.length === 0, "nevybraný kontakt nevidí");

console.log("\n7) Vypršení poptávky");
await as(C);
const R3 = (await one(`select create_request($1,$2,'Liberec','Oprava zásuvky','Nefunkční zásuvka v kuchyni, potřebuji opravu.','small',null) id`, [elektro, liberec])).id;
await offer(P3, R3); await offer(P4, R3);
ok(await avail(P3) === 150, "P3 zablokoval 50");
await db.query(`update job_requests set expires_at = now() - interval '1 day' where id=$1`, [R3]);
ok((await one(`select expire_requests() n`)).n === 1, "denní úloha uzavřela 1 poptávku");
ok(await avail(P3) === 200 && await avail(P4) === 200, "po vypršení se kredity vrátily");
await expectErr(() => offer(P5, R3), "POPTAVKA_UZAVRENA", "na vypršelou poptávku nejde nabízet");

console.log("\n8) Zrušení poptávky");
await as(C);
const R4 = (await one(`select create_request($1,$2,'Liberec','Revize elektro','Potřebuji revizi elektroinstalace v bytě.','small',null) id`, [elektro, liberec])).id;
await offer(P4, R4);
await as(C); await db.query(`select cancel_request($1)`, [R4]);
ok(await avail(P4) === 200, "zrušení → kredity vráceny");

console.log("\n9) Platby");
const pay = (await one(`insert into payments (provider_id, package_code, credits, price_czk) values ($1,'p1500',1650,1500) returning id`, [P1])).id;
await db.query(`select confirm_payment($1,'TX-1')`, [pay]);
await db.query(`select confirm_payment($1,'TX-1')`, [pay]);
ok(await avail(P1) === 50 + 1650, "platba připsána jen jednou i při dvojím potvrzení");

console.log("\n10) Pravidla přístupu (RLS)");
await db.exec(`set role authenticated`);
await as(P3);
ok((await db.query(`select * from credit_ledger`)).rows.every(r => r.provider_id === P3), "řemeslník vidí jen svoje pohyby kreditů");
ok((await db.query(`select * from offers where provider_id <> $1`, [P3])).rows.length === 0, "řemeslník nevidí cizí nabídky");
await as(PX);
ok((await db.query(`select * from job_requests`)).rows.length === 0, "instalatér nevidí poptávky elektro");
await as(P5);
ok((await db.query(`select * from job_requests where id=$1`, [R2])).rows.length === 1, "elektrikář vidí otevřenou elektro poptávku");
await as(C);
ok((await db.query(`select * from offers where request_id=$1`, [R1])).rows.length === 5, "zákazník vidí nabídky na svou poptávku");
ok((await db.query(`select * from profiles`)).rows.length === 1, "uživatel vidí jen svůj profil");
await expectErr(() => db.query(`insert into credit_ledger (provider_id, kind, amount) values ($1,'bonus',99999)`, [C]),
  "row-level security", "kredity nejde přidat napřímo");
await expectErr(() => db.query(`select confirm_payment($1,'x')`, [pay]), "permission denied", "potvrzení platby nemůže volat uživatel");
await db.exec(`reset role`);

console.log("\n11) Hodnocení");
await db.exec(`grant select, insert, update, delete on reviews to authenticated; revoke execute on function _refresh_provider_rating(uuid) from authenticated;`);
await as(P3);
await expectErr(() => db.query(`select submit_review($1, 5, 'x')`, [R1]), "NENI_VASE_POPTAVKA", "cizí člověk nemůže hodnotit");
await as(C);
await expectErr(() => db.query(`select submit_review($1, 5, 'x')`, [R3]), "NELZE_HODNOTIT", "nelze hodnotit poptávku bez vybraného řemeslníka");
await expectErr(() => db.query(`select submit_review($1, 7, 'x')`, [R1]), "SPATNE_HODNOCENI", "hodnocení mimo 1–5 neprojde");
const REV = (await one(`select submit_review($1, 4, 'Rychlé a čisté') id`, [R1])).id;
const pp = await one(`select rating_avg::float a, rating_count c from provider_profiles where user_id=$1`, [P1]);
ok(pp.a === 4 && pp.c === 1, "průměr řemeslníka se přepočítal (4.0, 1×)");
await expectErr(() => db.query(`select submit_review($1, 1, 'znovu')`, [R1]), "UZ_HODNOCENO", "podruhé hodnotit nejde");
await as(P3);
await expectErr(() => db.query(`select reply_review($1, 'díky')`, [REV]), "NENI_VASE_HODNOCENI", "cizí řemeslník nemůže odpovědět");
await as(P1);
await db.query(`select reply_review($1, 'Děkujeme!')`, [REV]);
ok((await one(`select reply from reviews where id=$1`, [REV])).reply === "Děkujeme!", "řemeslník odpověděl");
await expectErr(() => db.query(`select reply_review($1, 'znovu')`, [REV]), "UZ_ODPOVEZENO", "odpovědět jde jen jednou");
await db.exec(`set role authenticated`);
await as(C);
await expectErr(() => db.query(`update reviews set rating = 5 where id = $1 returning id`, [REV]).then(r => { if (!r.rows.length) throw new Error("row-level security"); }),
  "row-level security", "hodnocení nejde napřímo přepsat");
await db.exec(`reset role`);

console.log("\n12) Zprávy");
await db.exec(`grant select, insert, update, delete on messages, disputes, provider_photos to authenticated;
  grant usage on all sequences in schema public to authenticated;
  revoke execute on function expire_credits() from authenticated;`);
await as(C);
const R5 = (await one(`select create_request($1,$2,'Liberec','Nová zásuvka v garáži','Potřebuji přivést zásuvku do garáže, cca 10 m.','small',null) id`, [elektro, liberec])).id;
await offer(P5, R5);
await as(C);
await db.query(`select send_message($1,$2,'Dobrý den, zavolejte mi na 777 123 456 nebo pis@seznam.cz')`, [R5, P5]);
const m1 = (await one(`select body from messages where request_id=$1 order by id desc limit 1`, [R5])).body;
ok(!m1.includes("777") && !m1.includes("@"), "před výběrem se telefon a e-mail ve zprávě skryjí: " + m1);
await as(P5);
await db.query(`select send_message($1,$2,'Rád, kdy se mohu přijet podívat?')`, [R5, P5]);
await as(P4);
await expectErr(() => db.query(`select send_message($1,$2,'ahoj')`, [R5, P5]), "NENI_VASE_VLAKNO", "cizí řemeslník do vlákna psát nemůže");
await db.exec(`set role authenticated`);
await as(P4);
ok((await db.query(`select * from messages where request_id=$1`, [R5])).rows.length === 0, "cizí řemeslník zprávy nevidí");
await as(C);
ok((await db.query(`select * from messages where request_id=$1`, [R5])).rows.length === 2, "zákazník vidí celé vlákno");
await db.exec(`reset role`);
await as(C); await db.query(`select select_offer(id) from offers where request_id=$1 and provider_id=$2`, [R5, P5]);
await db.query(`select send_message($1,$2,'Volejte 777 123 456')`, [R5, P5]);
ok((await one(`select body from messages where request_id=$1 order by id desc limit 1`, [R5])).body.includes("777 123 456"), "po výběru se kontakty už neskrývají");

console.log("\n13) Reklamace");
const O5sel = (await one(`select id from offers where request_id=$1 and provider_id=$2`, [R5, P5])).id;
const before = await avail(P5);
await as(P4);
await expectErr(() => db.query(`select open_dispute($1,'Zákazník nereaguje na telefon')`, [O5sel]), "NABIDKA_NEEXISTUJE", "cizí reklamaci podat nejde");
await as(P5);
const D1 = (await one(`select open_dispute($1,'Zákazník nereaguje na telefon ani e-mail') id`, [O5sel])).id;
await expectErr(() => db.query(`select open_dispute($1,'Znovu a znovu a znovu')`, [O5sel]), "REKLAMACE_UZ_EXISTUJE", "druhou reklamaci na stejnou zakázku podat nejde");
await expectErr(() => db.query(`select resolve_dispute($1,true,'ok')`, [D1]), "JEN_ADMIN", "řemeslník si reklamaci sám schválit nemůže");
const ADMIN = U(9);
await db.query(`insert into auth.users values ($1,'admin@test.cz','{}')`, [ADMIN]);
await db.query(`update profiles set role='admin' where id=$1`, [ADMIN]);
await as(ADMIN);
await db.query(`select resolve_dispute($1,true,'Uznáno')`, [D1]);
ok(await avail(P5) === before + 50, "schválená reklamace vrátila 50 kreditů");
await expectErr(() => db.query(`select resolve_dispute($1,false,'x')`, [D1]), "REKLAMACE_VYRIZENA", "vyřízenou reklamaci nejde změnit");

console.log("\n14) Admin úprava kreditů");
await as(ADMIN);
await db.query(`select admin_adjust_credits($1, 100, 'Kompenzace')`, [P4]);
ok(await avail(P4) === 300, "admin přidal 100 kreditů");
await expectErr(() => db.query(`select admin_adjust_credits($1, -1000, 'x')`, [P4]), "NEDOSTATEK_KREDITU", "nejde ubrat víc, než má");
await as(P4);
await expectErr(() => db.query(`select admin_adjust_credits($1, 100, 'x')`, [P4]), "JEN_ADMIN", "běžný uživatel si kredity přidat nemůže");

console.log("\n15) Expirace kreditů");
// P2 má 200 kreditů z bonusu; posuneme bonus 13 měsíců do minulosti
await db.query(`update credit_ledger set created_at = now() - interval '13 months' where provider_id=$1 and kind='bonus'`, [P2]);
// P3 má bonus 200 a utratil 0, ale koupí si nové kredity dnes
await db.query(`update credit_ledger set created_at = now() - interval '13 months' where provider_id=$1 and kind='bonus'`, [P3]);
const pay3 = (await one(`insert into payments (provider_id, package_code, credits, price_czk) values ($1,'p500',500,500) returning id`, [P3])).id;
await db.query(`select confirm_payment($1,'TX-3')`, [pay3]);
// P1: bonus starý, ale část utratil (150 strženo) a dnes koupil 1650
await db.query(`update credit_ledger set created_at = now() - interval '13 months' where provider_id=$1 and kind='bonus'`, [P1]);
const a1 = await avail(P1), a2 = await avail(P2), a3 = await avail(P3);
await db.query(`select expire_credits()`);
ok(await avail(P2) === a2 - 200, `P2: propadlo celých 200 starých kreditů (${a2} → ${await avail(P2)})`);
ok(await avail(P3) === a3 - 200, `P3: propadlo jen 200 starých, nové zůstaly (${a3} → ${await avail(P3)})`);
ok(await avail(P1) === a1 - 50, `P1: z 200 starých utratil 150, propadlo jen 50 (${a1} → ${await avail(P1)})`);
await db.query(`select expire_credits()`);
ok(await avail(P1) === a1 - 50 && await avail(P2) === a2 - 200, "druhé spuštění už nic dalšího nestrhne");

console.log("\n16) Profilová fotka");
await as(P1);
ok((await one(`select set_my_avatar($1) old`, [`${P1}/avatar-1.jpg`])).old === null, "řemeslník si nastavil fotku");
ok((await one(`select set_my_avatar($1) old`, [`${P1}/avatar-2.jpg`])).old === `${P1}/avatar-1.jpg`, "výměna fotky vrátí starou (ke smazání)");
await expectErr(() => db.query(`select set_my_avatar($1)`, [`${P2}/cizi.jpg`]), "SPATNA_CESTA", "nejde nastavit fotku z cizí složky");
await as(C);
await expectErr(() => db.query(`select set_my_avatar($1)`, [`${C}/a.jpg`]), "NEJSTE_REMESLNIK", "zákazník bez profilu fotku nastavit nemůže");

console.log("\n17) IČO");
await as(P1);
await db.query(`select upsert_provider_profile('Alexandru Badasco','0691 7127','Popis','Liberec',$1,$2,'Na Františku 106/4, 46010 Liberec')`, [[elektro], [liberec]]);
const pp1 = await one(`select ico, address from provider_profiles where user_id=$1`, [P1]);
ok(pp1.ico === "06917127" && pp1.address.startsWith("Na Františku"), "IČO (bez mezer) a adresa uloženy");
await as(P2);
await expectErr(() => db.query(`select upsert_provider_profile('Jiná firma','06917127',null,'Liberec',$1,$2)`, [[elektro], [liberec]]),
  "ICO_UZ_REGISTROVANO", "stejné IČO nejde použít pro druhý účet");
await as(P1);
await db.query(`select upsert_provider_profile('Alexandru Badasco','06917127','Nový popis','Liberec',$1,$2)`, [[elektro], [liberec]]);
ok((await one(`select description from provider_profiles where user_id=$1`, [P1])).description === "Nový popis", "vlastní IČO jde při úpravě profilu ponechat");

console.log("\n18) Upozornění");
await db.exec(`grant select on notifications to authenticated`);
const unread = async (uid, req) => (await one(`select count(*)::int n from notifications where user_id=$1 and read_at is null ${req ? "and request_id=$2" : ""}`, req ? [uid, req] : [uid])).n;
await as(C);
const R9 = (await one(`select create_request($1,$2,'Liberec','Osvětlení na zahradě','Potřebuji udělat osvětlení zahrady, 6 světel.','small',null) id`, [elektro, liberec])).id;
ok(await unread(P3, R9) === 1 && await unread(P4, R9) === 1, "řemeslníci v oboru a kraji dostali upozornění na novou poptávku");
ok(await unread(PX, R9) === 0, "instalatér upozornění nedostal");
ok(await unread(C, R9) === 0, "zákazník nemá upozornění na vlastní poptávku");
const O9 = await offer(P3, R9);
ok(await unread(C, R9) === 1, "zákazník dostal upozornění na novou nabídku");
await offer(P4, R9);
ok(await unread(C, R9) === 2, "druhá nabídka = druhé upozornění");
await as(P3); await db.query(`select send_message($1,$2,'Dobrý den, kolik metrů kabelu?')`, [R9, P3]);
ok(await unread(C, R9) === 3, "zpráva od řemeslníka → upozornění zákazníkovi");
await db.exec(`set role authenticated`);
await as(C);
ok((await db.query(`select * from notifications`)).rows.every(n => n.user_id === C), "každý vidí jen svoje upozornění");
await db.exec(`reset role`);
await as(C); await db.query(`select mark_request_seen($1)`, [R9]);
ok(await unread(C, R9) === 0, "otevřením poptávky se upozornění přečtou");
await db.query(`select select_offer($1)`, [O9]);
ok(await unread(P3, R9) >= 1 && (await one(`select count(*)::int n from notifications where user_id=$1 and kind='selected'`, [P3])).n === 1, "vybraný řemeslník dostal upozornění");
ok((await one(`select count(*)::int n from notifications where user_id=$1 and request_id=$2 and kind='closed'`, [P4, R9])).n === 1, "nevybraný řemeslník dostal upozornění o uzavření");
await as(P4); await db.query(`select mark_all_seen()`);
ok(await unread(P4) === 0, "označit vše jako přečtené");

console.log(`\nVýsledek: ${pass} OK, ${fail} chyb`);
process.exit(fail ? 1 : 0);
