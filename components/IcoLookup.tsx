"use client";

import { useRef, useState } from "react";

type Company = { ico: string; name: string; address: string; city: string; regionName: string };

/**
 * Pole IČO s tlačítkem „Načíst z ARES“. Po nalezení vyplní ve stejném formuláři
 * pole company_name, city, address a zaškrtne kraj (checkbox s data-region-name).
 */
export default function IcoLookup({ defaultValue = "", required = false }: { defaultValue?: string; required?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [found, setFound] = useState<Company | null>(null);

  async function load() {
    const ico = (ref.current?.value || "").replace(/\s/g, "");
    if (!ico) return;
    setState("loading"); setMsg(""); setFound(null);
    try {
      const res = await fetch(`/api/ares?ico=${encodeURIComponent(ico)}`);
      const data = await res.json();
      if (!res.ok) { setState("error"); setMsg(data.error); return; }
      const c = data as Company;
      const form = ref.current!.form!;
      const set = (name: string, value: string) => {
        const el = form.elements.namedItem(name) as HTMLInputElement | null;
        if (el && value) el.value = value;
      };
      ref.current!.value = c.ico;
      set("company_name", c.name);
      set("city", c.city);
      set("address", c.address);
      form.querySelectorAll<HTMLInputElement>("input[data-region-name]").forEach((cb) => {
        if (cb.dataset.regionName === c.regionName) cb.checked = true;
      });
      setFound(c); setState("ok");
    } catch {
      setState("error"); setMsg("Nepodařilo se spojit s ARES. Údaje můžete vyplnit ručně.");
    }
  }

  return (
    <div className="field">
      <label>IČO</label>
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <input ref={ref} type="text" name="ico" inputMode="numeric" maxLength={10} required={required}
          defaultValue={defaultValue} placeholder="12345678"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); load(); } }}
          onBlur={() => { if (state === "idle" && ref.current?.value.replace(/\s/g, "").length === 8) load(); }} />
        <button type="button" onClick={load} className="btn secondary" disabled={state === "loading"} style={{ whiteSpace: "nowrap" }}>
          {state === "loading" ? "Hledám…" : "Načíst z ARES"}
        </button>
      </div>
      {state === "ok" && found && (
        <div className="alert ok" style={{ marginTop: 8, marginBottom: 0 }}>
          ✓ <strong>{found.name}</strong><br /><span className="small">{found.address}</span>
        </div>
      )}
      {state === "error" && <div className="alert error" style={{ marginTop: 8, marginBottom: 0 }}>{msg}</div>}
      {state === "idle" && <div className="hint">Zadejte IČO a údaje o firmě se doplní z obchodního rejstříku.</div>}
    </div>
  );
}
