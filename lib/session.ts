import { redirect } from "next/navigation";
import { createClient } from "./supabase";

export type Me = {
  id: string;
  email: string | null;
  role: "customer" | "provider" | "admin";
  full_name: string | null;
  phone: string | null;
  isProvider: boolean;
};

/** Aktuálně přihlášený uživatel, nebo null */
export async function getMe(): Promise<Me | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase
    .from("profiles")
    .select("role, full_name, phone, email")
    .eq("id", user.id)
    .single();
  return {
    id: user.id,
    email: p?.email ?? user.email ?? null,
    role: (p?.role ?? "customer") as Me["role"],
    full_name: p?.full_name ?? null,
    phone: p?.phone ?? null,
    isProvider: p?.role === "provider" || p?.role === "admin",
  };
}

export async function requireMe(next = "/"): Promise<Me> {
  const me = await getMe();
  if (!me) redirect(`/prihlaseni?dalsi=${encodeURIComponent(next)}`);
  return me;
}
