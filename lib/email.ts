import { SITE_NAME } from "./config";

/** Odeslání e-mailu přes Resend. Bez API klíče se e-mail jen vypíše do konzole (vývoj). */
export async function sendEmail(to: string | null | undefined, subject: string, text: string) {
  if (!to) return;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[e-mail] → ${to}\n  ${subject}\n  ${text.replace(/\n/g, "\n  ")}`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || `${SITE_NAME} <noreply@example.com>`,
        to,
        subject,
        text: `${text}\n\n—\n${SITE_NAME}`,
      }),
    });
    if (!res.ok) console.error("[e-mail] chyba", res.status, await res.text());
  } catch (e) {
    // e-mail nesmí shodit hlavní akci (nabídku, výběr…)
    console.error("[e-mail] chyba", e);
  }
}
