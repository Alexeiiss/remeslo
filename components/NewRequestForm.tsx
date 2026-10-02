"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { createRequest, notifyNewRequest } from "@/app/poptavka/nova/actions";
import { ACCEPT, MAX_FILES, checkFile, fmtSize, isImage, uploadRequestFiles } from "@/lib/upload-client";

type Opt = { id: number; name: string };

export default function NewRequestForm({ categories, regions, sizes, preselected }: {
  categories: Opt[]; regions: Opt[]; sizes: { size: string; label: string }[]; preselected?: number;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const errs: string[] = [];
    const next = [...files];
    for (const f of Array.from(list)) {
      const e = checkFile(f);
      if (e) { errs.push(e); continue; }
      if (next.length >= MAX_FILES) { errs.push(`Maximálně ${MAX_FILES} příloh.`); break; }
      next.push(f);
    }
    setFiles(next);
    setError(errs.length ? errs.join(" ") : null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setStatus("Ukládám poptávku…");
    const res = await createRequest(new FormData(e.currentTarget));
    if ("redirect" in res) { router.push(res.redirect); return; }
    if ("error" in res) { setError(res.error); setStatus(null); window.scrollTo({ top: 0, behavior: "smooth" }); return; }

    let failed = 0;
    if (files.length) {
      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      setStatus(`Nahrávám přílohy 0 / ${files.length}…`);
      const ok = await uploadRequestFiles(supabase, res.id, files, (n) => setStatus(`Nahrávám přílohy ${n} / ${files.length}…`));
      failed = files.length - ok;
    }
    setStatus("Rozesílám řemeslníkům…");
    await notifyNewRequest(res.id);
    router.push(`/poptavka/${res.id}?nova=1${failed ? `&chyba=${encodeURIComponent(`${failed} příloh se nepodařilo nahrát, můžete je přidat znovu.`)}` : ""}`);
  }

  const busy = status !== null;

  return (
    <form onSubmit={onSubmit} className="card">
      {error && <div className="alert error">{error}</div>}

      <h2>1. Co potřebujete</h2>
      <div className="field">
        <label>Obor</label>
        <select name="category_id" required defaultValue={preselected ?? ""}>
          <option value="" disabled>Vyberte obor…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Název poptávky</label>
        <input type="text" name="title" required minLength={5} maxLength={120} placeholder="Např. Výměna rozvaděče v rodinném domě" />
      </div>
      <div className="field">
        <label>Popis práce</label>
        <textarea name="description" required minLength={20} maxLength={5000} placeholder="Co přesně je potřeba udělat, rozměry, materiál, stav…" />
      </div>

      <div className="field">
        <label>Fotky a soubory <span className="hint">(nepovinné)</span></label>
        <div className="hint" style={{ marginBottom: 8 }}>
          Fotky, PDF, Excel, Word, výkresy (DWG/DXF). Max. {MAX_FILES} souborů po 10 MB. Řemeslníkům hodně pomohou s cenou.
        </div>
        {files.length > 0 && (
          <div className="stack" style={{ marginBottom: 10 }}>
            {files.map((f, i) => (
              <div key={i} className="row between" style={{ background: "var(--bg)", borderRadius: 8, padding: "6px 10px", flexWrap: "nowrap" }}>
                <span className="row" style={{ gap: 10, flexWrap: "nowrap", minWidth: 0 }}>
                  {isImage(f)
                    ? <img src={URL.createObjectURL(f)} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6 }} />
                    : <span style={{ width: 40, textAlign: "center", fontSize: 22 }}>📄</span>}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  <span className="small muted" style={{ whiteSpace: "nowrap" }}>{fmtSize(f.size)}</span>
                </span>
                <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  className="btn secondary" style={{ padding: "4px 10px", border: 0 }} title="Odebrat">✕</button>
              </div>
            ))}
          </div>
        )}
        {files.length < MAX_FILES && (
          <label className="btn secondary" style={{ cursor: "pointer" }}>
            + Přidat fotky nebo soubory
            <input ref={fileInput} type="file" multiple accept={ACCEPT} onChange={(e) => addFiles(e.target.files)} style={{ display: "none" }} />
          </label>
        )}
      </div>

      <h2 style={{ marginTop: 24 }}>2. Kde a kdy</h2>
      <div className="grid grid-2">
        <div className="field">
          <label>Kraj</label>
          <select name="region_id" required defaultValue="">
            <option value="" disabled>Vyberte kraj…</option>
            {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div className="field"><label>Obec</label><input type="text" name="city" required placeholder="Např. Liberec" /></div>
      </div>
      <div className="field">
        <label>Kdy začít</label>
        <select name="preferred_start" defaultValue="Co nejdříve">
          <option>Co nejdříve</option><option>Do měsíce</option><option>Do 3 měsíců</option><option>Termín je flexibilní</option>
        </select>
      </div>

      <h2 style={{ marginTop: 24 }}>3. Odhad velikosti zakázky</h2>
      <div className="field">
        <select name="size" required defaultValue="">
          <option value="" disabled>Vyberte…</option>
          {sizes.map((s) => <option key={s.size} value={s.size}>{s.label}</option>)}
        </select>
        <div className="hint">Stačí odhad. Pomůže řemeslníkům rozhodnout, jestli zakázku zvládnou.</div>
      </div>

      <button className="btn accent block" disabled={busy}>{status ?? "Odeslat poptávku"}</button>
    </form>
  );
}
