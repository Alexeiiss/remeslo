"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Nahrávání fotek přímo z prohlížeče do Supabase Storage.
 * Fotky se před odesláním zmenší (max. 1600 px, JPEG), takže i velké fotky z mobilu
 * jdou rychle a nenarazí na limit serveru.
 */
export default function PhotoUploader({
  bucket, folder, table, row, max, current, label = "Přidat fotky",
}: {
  bucket: string;                 // "provider-photos" | "request-photos"
  folder: string;                 // první složka cesty (id řemeslníka / poptávky)
  table: string;                  // "provider_photos" | "request_photos"
  row: Record<string, string>;    // další sloupce záznamu, např. { provider_id }
  max: number;
  current: number;
  label?: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const left = max - current;

  async function shrink(file: File): Promise<Blob> {
    const img = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return new Promise((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", 0.82));
  }

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    if (files.length > left) { setMsg(`Můžete přidat ještě ${left} fotek.`); return; }
    setBusy(true); setMsg(null);
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    let ok = 0;
    for (const f of files) {
      try {
        const blob = await shrink(f);
        const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        const { error: e2 } = await supabase.from(table).insert({ ...row, storage_path: path });
        if (e2) throw e2;
        ok++;
      } catch (err) {
        console.error(err);
      }
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    setMsg(ok === files.length ? `Nahráno ${ok} fotek.` : `Nahráno ${ok} z ${files.length}. Zbytek se nepodařilo nahrát.`);
    router.refresh();
  }

  if (left <= 0) return <p className="small muted">Máte maximální počet fotek ({max}).</p>;
  return (
    <div>
      <label className="btn secondary" style={{ cursor: busy ? "wait" : "pointer", fontWeight: 600 }}>
        {busy ? "Nahrávám…" : label}
        <input ref={input} type="file" accept="image/*" multiple onChange={onChange} disabled={busy} style={{ display: "none" }} />
      </label>
      {msg && <div className="small muted" style={{ marginTop: 6 }}>{msg}</div>}
    </div>
  );
}
