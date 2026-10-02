import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container" style={{ maxWidth: 560 }}>
      <div className="card">
        <h1>Stránka nenalezena</h1>
        <p className="muted">Poptávka možná neexistuje, už je uzavřená, nebo k ní nemáte přístup.</p>
        <Link href="/" className="btn">Na úvod</Link>
      </div>
    </main>
  );
}
