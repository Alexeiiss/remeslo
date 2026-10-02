"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { ACCEPT, MAX_FILES, checkFile, uploadRequestFiles } from "@/lib/upload-client";

/** Přidání dalších fotek a souborů k už vytvořené poptávce */
export default function AttachmentUploader({ requestId, current }: { requestId: string; current: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const left = MAX_FILES - current;

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const all = Array.from(e.target.files ?? []);
    if (input.current) input.current.value = "";
    if (!all.length) return;
    const errs = all.map(checkFile).filter(Boolean) as string[];
    const files = all.filter((f) => !checkFile(f)).slice(0, left);
    if (all.length - errs.length > left) errs.push(`Můžete přidat ještě ${left} příloh.`);
    if (!files.length) { setMsg(errs.join(" ")); return; }
    setBusy(true);
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const ok = await uploadRequestFiles(supabase, requestId, files, (n) => setMsg(`Nahrávám ${n} / ${files.length}…`));
    setBusy(false);
    setMsg([ok === files.length ? `Nahráno ${ok} příloh.` : `Nahráno ${ok} z ${files.length}.`, ...errs].join(" "));
    router.refresh();
  }

  if (left <= 0) return null;
  return (
    <div>
      <label className="btn secondary" style={{ cursor: busy ? "wait" : "pointer" }}>
        {busy ? "Nahrávám…" : current ? "+ Přidat další fotky nebo soubory" : "+ Přidat fotky nebo soubory"}
        <input ref={input} type="file" multiple accept={ACCEPT} onChange={onChange} disabled={busy} style={{ display: "none" }} />
      </label>
      {msg && <div className="small muted" style={{ marginTop: 6 }}>{msg}</div>}
    </div>
  );
}
