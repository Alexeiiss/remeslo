/** Profilová fotka řemeslníka, nebo kolečko s iniciálami, když fotku nemá */
export default function Avatar({ url, name, size = 56 }: { url?: string | null; name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
  const style: React.CSSProperties = {
    width: size, height: size, borderRadius: "50%", flexShrink: 0, objectFit: "cover",
    border: "2px solid var(--surface)", boxShadow: "0 0 0 1px var(--line)",
  };
  if (url) return <img src={url} alt={name} style={style} />;
  return (
    <div aria-hidden style={{
      ...style, display: "grid", placeItems: "center", background: "var(--brand-soft)",
      color: "var(--brand)", fontWeight: 800, fontSize: size * 0.38,
    }}>{initials}</div>
  );
}

/** Veřejná adresa profilové fotky z úložiště Supabase */
export function avatarUrl(path?: string | null) {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/provider-photos/${path}`;
}
