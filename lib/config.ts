export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "Řemeslo.cz";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const JOB_SIZE_LABEL: Record<string, string> = {
  small: "Malá (do 5 000 Kč)",
  medium: "Střední (5 000 – 50 000 Kč)",
  large: "Velká (50 000 – 300 000 Kč)",
  xlarge: "Velmi velká (nad 300 000 Kč)",
};

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  open: "Čeká na nabídky",
  assigned: "Řemeslník vybrán",
  expired: "Vypršela",
  cancelled: "Zrušena",
};

export const OFFER_STATUS_LABEL: Record<string, string> = {
  pending: "Čeká na zákazníka",
  selected: "Vybrána – zakázka je vaše",
  rejected: "Nevybrána – kredity vráceny",
  withdrawn: "Stažena – kredity vráceny",
};

export const LEDGER_LABEL: Record<string, string> = {
  purchase: "Nákup kreditů",
  bonus: "Bonus",
  hold: "Zablokováno za nabídku",
  capture: "Získaná zakázka",
  release: "Vráceno",
  refund: "Vráceno (reklamace)",
  adjust: "Úprava",
  expire: "Propadlo",
};

/** Kódy chyb z databáze → srozumitelná česká hláška */
const ERRORS: Record<string, string> = {
  NEPRIHLASEN: "Nejste přihlášeni.",
  CHYBI_TELEFON: "Před zadáním poptávky doplňte v účtu telefon.",
  TELEFON_NEOVEREN: "Před zadáním poptávky si prosím ověřte telefon SMS kódem (níže na této stránce).",
  CHYBI_NAZEV: "Vyplňte název firmy nebo jméno.",
  CHYBI_OBOR: "Vyberte alespoň jeden obor.",
  CHYBI_KRAJ: "Vyberte alespoň jeden kraj.",
  NEJSTE_REMESLNIK: "Nejdřív si vyplňte řemeslnický profil.",
  POPTAVKA_NEEXISTUJE: "Poptávka neexistuje.",
  VLASTNI_POPTAVKA: "Na vlastní poptávku nemůžete nabízet.",
  POPTAVKA_UZAVRENA: "Poptávka už je uzavřená.",
  PLNY_POCET_NABIDEK: "Poptávka už má maximální počet nabídek.",
  MIMO_VAS_OBOR: "Tato poptávka není ve vašem oboru.",
  NABIDKA_UZ_EXISTUJE: "Na tuto poptávku už jste nabídku poslali.",
  NEDOSTATEK_KREDITU: "Nemáte dost kreditů. Dobijte si je v sekci Kredity.",
  NABIDKA_NEEXISTUJE: "Nabídka neexistuje.",
  NABIDKU_NELZE_STAHNOUT: "Nabídku už nelze stáhnout.",
  NENI_VASE_POPTAVKA: "Tato poptávka vám nepatří.",
  NABIDKA_NENI_AKTIVNI: "Nabídka už není aktivní.",
  NENI_VASE_VLAKNO: "Do této konverzace nemůžete psát.",
  VLAKNO_UZAVRENO: "Konverzace je uzavřená, nabídka už není aktivní.",
  PRAZDNA_ZPRAVA: "Napište text zprávy.",
  REKLAMACE_NELZE: "Reklamovat lze jen získanou zakázku.",
  REKLAMACE_PO_LHUTE: "Lhůta pro reklamaci (30 dnů) už uplynula.",
  REKLAMACE_UZ_EXISTUJE: "Reklamaci k této zakázce už jste podali.",
  REKLAMACE_KRATKY_DUVOD: "Popište důvod reklamace (aspoň 10 znaků).",
  REKLAMACE_NEEXISTUJE: "Reklamace neexistuje.",
  REKLAMACE_VYRIZENA: "Reklamace už je vyřízená.",
  JEN_ADMIN: "Tato akce je jen pro administrátora.",
  ICO_UZ_REGISTROVANO: "Toto IČO už používá jiný řemeslnický účet. Pokud je vaše, kontaktujte nás.",
};

export function humanError(message?: string | null): string {
  if (!message) return "Něco se pokazilo, zkuste to prosím znovu.";
  const code = Object.keys(ERRORS).find((k) => message.includes(k));
  return code ? ERRORS[code] : "Něco se pokazilo, zkuste to prosím znovu.";
}

export const czk = (n: number) =>
  new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(n);

export const date = (d: string | Date) =>
  new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" }).format(new Date(d));

export const dateTime = (d: string | Date) =>
  new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
