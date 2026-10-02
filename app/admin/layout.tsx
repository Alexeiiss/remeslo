import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

export const metadata = { title: "Administrace", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <main className="container stack">
      <nav className="row" style={{ gap: 6 }}>
        <strong style={{ marginRight: 8 }}>Administrace</strong>
        <Link href="/admin" className="btn secondary">Přehled</Link>
        <Link href="/admin/reklamace" className="btn secondary">Reklamace</Link>
        <Link href="/admin/remeslnici" className="btn secondary">Řemeslníci a kredity</Link>
        <Link href="/admin/poptavky" className="btn secondary">Poptávky</Link>
      </nav>
      {children}
    </main>
  );
}
