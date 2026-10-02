"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

/** „+420 777 123 456“ → „+420777123456“ (formát, který chce SMS brána) */
export function toE164(raw: string) {
  const d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return "+" + d.slice(1).replace(/\D/g, "");
  if (d.startsWith("00")) return "+" + d.slice(2);
  if (d.length === 9) return "+420" + d;
  return "+" + d;
}

/** Ověření telefonu SMS kódem (přes Supabase Auth a nastavenou SMS bránu) */
export default function PhoneVerify({ phone, verified }: { phone: string | null; verified: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "sent" | "busy">("idle");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const supabase = () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  if (verified) return <div className="alert ok" style={{ margin: 0 }}>✓ Telefon {phone} je ověřený.</div>;
  if (!phone) return <p className="muted small">Nejdřív výše vyplňte a uložte telefon.</p>;

  async function send() {
    setStep("busy"); setMsg(null);
    const { error } = await supabase().auth.updateUser({ phone: toE164(phone!) });
    if (error) {
      setStep("idle");
      const m = error.message.toLowerCase();
      setMsg({ ok: false, text:
        m.includes("provider") || m.includes("sms") && m.includes("disabled") ? "SMS ověřování zatím není zapnuté. Zkuste to prosím později."
        : m.includes("rate") ? "Příliš mnoho pokusů. Zkuste to za pár minut."
        : m.includes("already") ? "Toto číslo už používá jiný účet."
        : "SMS se nepodařilo odeslat. Zkontrolujte číslo a zkuste to znovu." });
      return;
    }
    setStep("sent");
    setMsg({ ok: true, text: `Poslali jsme SMS s kódem na ${phone}.` });
  }

  async function verify() {
    setStep("busy");
    const sb = supabase();
    const { error } = await sb.auth.verifyOtp({ phone: toE164(phone!), token: code.trim(), type: "phone_change" });
    if (error) {
      setStep("sent");
      setMsg({ ok: false, text: "Kód nesedí nebo vypršel. Zkontrolujte ho, případně si nechte poslat nový." });
      return;
    }
    await sb.rpc("verify_my_phone");
    setMsg({ ok: true, text: "Telefon je ověřený." });
    router.refresh();
  }

  return (
    <div>
      <p className="muted small" style={{ marginTop: 0 }}>Ověřený telefon zvyšuje důvěru řemeslníků a chrání portál před falešnými poptávkami.</p>
      {msg && <div className={`alert ${msg.ok ? "ok" : "error"}`}>{msg.text}</div>}
      {step !== "sent" ? (
        <button type="button" className="btn secondary" onClick={send} disabled={step === "busy"}>
          {step === "busy" ? "Odesílám…" : "Poslat ověřovací SMS"}
        </button>
      ) : (
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Kód z SMS"
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} style={{ maxWidth: 160 }} />
          <button type="button" className="btn" onClick={verify} disabled={code.length < 6}>Ověřit</button>
          <button type="button" className="btn secondary" onClick={send} style={{ border: 0 }}>Poslat znovu</button>
        </div>
      )}
    </div>
  );
}
