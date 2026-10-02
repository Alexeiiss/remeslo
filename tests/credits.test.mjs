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
  await db.query(`select upsert_provider_profile($1,'06917127','Popis','Liberec',$2,$3)`,
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

console.log(`\nVýsledek: ${pass} OK, ${fail} chyb`);
process.exit(fail ? 1 : 0);
