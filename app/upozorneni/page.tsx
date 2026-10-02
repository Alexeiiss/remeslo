import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase";
import { requireMe } from "@/lib/session";
import { dateTime } from "@/lib/config";

export const metadata = { title: "Upozornění" };

const ICON: Record<string, string> = {
  new_offer: "💬", new_message: "✉️", selected: "🎉", closed: "↩️",
  review: "⭐", new_request: "🔨", dispute: "📋",
};

async function markAll() {
  "use server";
  const supabase = await createClient();
  await supabase.rpc("mark_all_seen");
  revalidatePath("/", "layout");
}

export default async function NotificationsPage() {
  await requireMe("/upozorneni");
  const supabase = await createClient();
  const { data: list } = await supabase.from("notifications")
    .select("id, kind, request_id, text, created_at, read_at")
    .order("created_at", { ascending: false }).limit(100);
  const unread = (list ?? []).filter((n) => !n.read_at).length;

  return (
    <main className="container stack" style={{ maxWidth: 760 }}>
      <div className="row between">
        <h1 style={{ margin: 0 }}>Upozornění</h1>
        {unread > 0 && (
          <form action={markAll}><button className="btn secondary">Označit vše jako přečtené</button></form>
        )}
      </div>
      {!list?.length && <div className="card muted">Zatím tu nic není. Až přijde nabídka, zpráva nebo nová poptávka, uvidíte ji tady.</div>}
      {!!list?.length && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {list.map((n, i) => (
            <Link key={n.id} href={n.request_id ? `/poptavka/${n.request_id}` : "#"}
              className={`notif ${n.read_at ? "" : "unread"}`}
              style={{ padding: "14px 18px", borderTop: i ? "1px solid var(--line)" : 0 }}>
              <span className={`dot ${n.read_at ? "read" : ""}`} />
              <span style={{ fontSize: 20 }}>{ICON[n.kind] ?? "🔔"}</span>
              <span style={{ flex: 1 }}>
                <span style={{ fontWeight: n.read_at ? 400 : 700 }}>{n.text}</span>
                <span className="small muted" style={{ display: "block" }}>{dateTime(n.created_at)}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
