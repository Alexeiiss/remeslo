import { createClient } from "@/lib/supabase";
import { requireMe } from "@/lib/session";
import NewRequestForm from "@/components/NewRequestForm";

export const metadata = { title: "Nová poptávka" };

type SP = Promise<{ chyba?: string; obor?: string }>;

export default async function NewRequestPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  await requireMe("/poptavka/nova" + (sp.obor ? `?obor=${sp.obor}` : ""));
  const supabase = await createClient();
  const [{ data: categories }, { data: regions }, { data: sizes }] = await Promise.all([
    supabase.from("categories").select("id, slug, name").order("sort_order"),
    supabase.from("regions").select("id, name").order("name"),
    supabase.from("job_size_prices").select("size, label").order("sort_order"),
  ]);
  const preselected = categories?.find((c) => c.slug === sp.obor)?.id;

  return (
    <main className="container" style={{ maxWidth: 720 }}>
      <h1>Zadat poptávku</h1>
      <p className="muted">Zdarma. Dostanete až 4 nabídky. Váš telefon a e-mail uvidí jen řemeslník, kterého si vyberete.</p>
      {sp.chyba && <div className="alert error">{sp.chyba}</div>}
      <NewRequestForm
        categories={categories ?? []} regions={regions ?? []} sizes={sizes ?? []} preselected={preselected} />
    </main>
  );
}
