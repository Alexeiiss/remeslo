"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import Avatar from "./Avatar";

/** Nahrání / změna profilové fotky. Fotka se v prohlížeči ořízne na čtverec 400×400. */
export default function AvatarUploader({ userId, name, currentUrl }: { userId: string; name: string; currentUrl: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);

  const supabase = () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  async function squareJpeg(file: File): Promise<Blob> {
    const img = await createImageBitmap(file);
    const side = Math.min(img.width, img.height);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 400;
    canvas.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 400, 400);
    return new Promise((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", 0.85));
  }

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setBusy(true); setMsg(null);
    try {
      const sb = supabase();
      const blob = await squareJpeg(file);
      const path = `${userId}/avatar-${Date.now()}.jpg`;
      const { error } = await sb.storage.from("provider-photos").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      const { data: old, error: e2 } = await sb.rpc("set_my_avatar", { p_path: path });
      if (e2) throw e2;
      if (old) await sb.storage.from("provider-photos").remove([old as string]);
      setPreview(URL.createObjectURL(blob));
      setMsg("Profilová fotka uložena.");
      router.refresh();
    } catch (err) {
      console.error(err);
      setMsg("Fotku se nepodařilo nahrát. Zkuste to znovu.");
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  async function remove() {
    if (!confirm("Odebrat profilovou fotku?")) return;
    setBusy(true);
    const sb = supabase();
    const { data: old } = await sb.rpc("set_my_avatar", { p_path: null });
    if (old) await sb.storage.from("provider-photos").remove([old as string]);
    setPreview(null); setBusy(false); setMsg("Fotka odebrána.");
    router.refresh();
  }

  return (
    <div className="row" style={{ gap: 16 }}>
      <Avatar url={preview} name={name} size={88} />
      <div>
        <label className="btn secondary" style={{ cursor: busy ? "wait" : "pointer" }}>
          {busy ? "Nahrávám…" : preview ? "Změnit fotku" : "Nahrát profilovou fotku"}
          <input ref={input} type="file" accept="image/*" onChange={onChange} disabled={busy} style={{ display: "none" }} />
        </label>
        {preview && !busy && (
          <button type="button" onClick={remove} className="btn secondary" style={{ marginLeft: 8, border: 0 }}>Odebrat</button>
        )}
        <div className="small muted" style={{ marginTop: 6 }}>{msg ?? "Ideálně vaše tvář nebo logo firmy. Ořízne se na čtverec."}</div>
      </div>
    </div>
  );
}
