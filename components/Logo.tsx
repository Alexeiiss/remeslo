/** Logo: domeček se střechou a klíčem – jednoduchá značka, funguje i v malé velikosti */
export default function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect x="0" y="0" width="40" height="40" rx="10" fill="var(--brand)" />
      <path d="M8 20.5 L20 10 L32 20.5" fill="none" stroke="var(--accent)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 19 V30 H28 V19" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M16.5 24.5 l2.6 2.6 l5-5.4" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
