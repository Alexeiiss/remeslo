import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase";
import { SITE_URL } from "@/lib/config";

export const revalidate = 86400;

// Mapa webu pro Google: všechny obory × kraje a veřejné profily řemeslníků
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = createPublicClient();
  const [{ data: cats }, { data: regions }, { data: providers }] = await Promise.all([
    db.from("categories").select("slug"),
    db.from("regions").select("slug"),
    db.from("provider_profiles").select("user_id, created_at").limit(5000),
  ]);
  const now = new Date();
  const urls: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, priority: 1 },
    { url: `${SITE_URL}/cenik`, lastModified: now, priority: 0.5 },
    { url: `${SITE_URL}/remeslnici`, lastModified: now, priority: 0.8 },
  ];
  for (const c of cats ?? []) {
    urls.push({ url: `${SITE_URL}/remeslnici/${c.slug}`, lastModified: now, priority: 0.8 });
    for (const r of regions ?? []) {
      urls.push({ url: `${SITE_URL}/remeslnici/${c.slug}/${r.slug}`, lastModified: now, priority: 0.7 });
    }
  }
  for (const p of providers ?? []) {
    urls.push({ url: `${SITE_URL}/firma/${p.user_id}`, lastModified: new Date(p.created_at), priority: 0.5 });
  }
  return urls;
}
