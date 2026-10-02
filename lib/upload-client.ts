"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

// Co smí zákazník k poptávce přiložit
export const MAX_FILES = 10;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ACCEPT = [
  "image/*", ".pdf",
  ".xls", ".xlsx", ".ods", ".csv",
  ".doc", ".docx", ".odt", ".txt", ".rtf",
  ".dwg", ".dxf",
].join(",");

const ALLOWED_EXT = /\.(jpe?g|png|gif|webp|heic|heif|pdf|xlsx?|ods|csv|docx?|odt|txt|rtf|dwg|dxf)$/i;

export function checkFile(f: File): string | null {
  if (!ALLOWED_EXT.test(f.name) && !f.type.startsWith("image/")) return `${f.name}: tento typ souboru nelze nahrát.`;
  if (f.size > MAX_FILE_BYTES) return `${f.name}: soubor je větší než 10 MB.`;
  return null;
}

export const isImage = (f: File) => f.type.startsWith("image/") && !/heic|heif/i.test(f.type);

/** Zmenší fotku na max. 1600 px (JPEG), ostatní soubory nechá beze změny */
async function prepare(f: File): Promise<{ blob: Blob; type: string; name: string }> {
  if (!isImage(f)) return { blob: f, type: f.type || "application/octet-stream", name: f.name };
  try {
    const img = await createImageBitmap(f);
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b ?? f), "image/jpeg", 0.82));
    return { blob, type: "image/jpeg", name: f.name.replace(/\.[^.]+$/, "") + ".jpg" };
  } catch {
    return { blob: f, type: f.type, name: f.name };
  }
}

const safe = (name: string) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80);

/** Nahraje soubory k poptávce. Vrací počet úspěšně nahraných. */
export async function uploadRequestFiles(
  supabase: SupabaseClient, requestId: string, files: File[], onProgress?: (done: number) => void,
) {
  let ok = 0;
  for (const f of files) {
    try {
      const { blob, type, name } = await prepare(f);
      const path = `${requestId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe(name)}`;
      const { error } = await supabase.storage.from("request-photos").upload(path, blob, { contentType: type });
      if (error) throw error;
      const { error: e2 } = await supabase.from("request_photos").insert({
        request_id: requestId, storage_path: path, file_name: name, content_type: type, size_bytes: blob.size,
      });
      if (e2) throw e2;
      ok++;
    } catch (err) {
      console.error("upload", f.name, err);
    }
    onProgress?.(ok);
  }
  return ok;
}

export const fmtSize = (b: number) =>
  b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} kB`;
