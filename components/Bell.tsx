"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Zvoneček v menu s počtem nepřečtených upozornění.
 * Aktualizuje se živě (Supabase Realtime) a pro jistotu i každou minutu.
 * Když přijde upozornění k právě otevřené poptávce, stránka se sama obnoví.
 */
export default function Bell({ userId, initial }: { userId: string; initial: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const [count, setCount] = useState(initial);
  const [pulse, setPulse] = useState(false);
  const baseTitle = useRef<string>("");
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => setCount(initial), [initial]);

  // Po přechodu na jinou stránku (např. otevření poptávky = přečtení) přepočítat
  useEffect(() => {
    const t = setTimeout(async () => {
      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { count: c } = await supabase.from("notifications")
        .select("id", { count: "exact", head: true }).is("read_at", null);
      if (typeof c === "number") setCount(c);
    }, 800);
    return () => clearTimeout(t);
  }, [pathname]);

  // Počet v názvu záložky: „(3) Moje poptávky“
  useEffect(() => {
    if (!baseTitle.current || !document.title.startsWith("(")) baseTitle.current = document.title.replace(/^\(\d+\+?\)\s*/, "");
    document.title = count > 0 ? `(${count > 99 ? "99+" : count}) ${baseTitle.current}` : baseTitle.current;
  }, [count, pathname]);

  useEffect(() => {
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    const refreshCount = async () => {
      const { count: c } = await supabase.from("notifications")
        .select("id", { count: "exact", head: true }).is("read_at", null);
      if (typeof c === "number") setCount(c);
    };

    const channel = supabase
      .channel(`notif-${userId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const requestId = (payload.new as { request_id?: string }).request_id;
          setPulse(true); setTimeout(() => setPulse(false), 1500);
          // Jsem právě na stránce té poptávky / v seznamech → obnovit obsah
          const p = pathRef.current;
          if ((requestId && p === `/poptavka/${requestId}`) || p === "/moje-poptavky" || p === "/remeslnik" || p === "/upozorneni") {
            router.refresh();
          } else {
            setCount((c) => c + 1);
          }
        })
      .subscribe();

    const timer = setInterval(refreshCount, 60_000);
    const onFocus = () => refreshCount();
    window.addEventListener("focus", onFocus);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [userId, router]);

  return (
    <Link href="/upozorneni" className={`bell ${pulse ? "bell-pulse" : ""}`} title="Upozornění" aria-label={`Upozornění: ${count} nových`}>
      🔔{count > 0 && <span className="bell-count">{count > 99 ? "99+" : count}</span>}
    </Link>
  );
}
