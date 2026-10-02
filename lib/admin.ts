import { notFound } from "next/navigation";
import { getMe } from "@/lib/session";

/** Vrátí přihlášeného admina, jinak stránka „neexistuje“ */
export async function requireAdmin() {
  const me = await getMe();
  if (!me || me.role !== "admin") notFound();
  return me;
}
