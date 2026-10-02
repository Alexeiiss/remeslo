import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { getPaymentStatus, isValidNotificationSecret } from "@/lib/comgate";
import { afterPaymentConfirmed } from "@/lib/billing";

// Notifikace o výsledku platby od Comgate (nastavit v portálu Comgate jako "URL pro předání výsledku platby")
export async function POST(request: NextRequest) {
  const type = request.headers.get("content-type") || "";
  const body: Record<string, string> = type.includes("json")
    ? await request.json()
    : Object.fromEntries(new URLSearchParams(await request.text()));

  if (!isValidNotificationSecret(body.secret)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const admin = createAdminClient();
  try {
    // Notifikaci nevěříme – stav si ověříme přímo u Comgate
    const { status, refId } = await getPaymentStatus(body.transId);
    const paymentId = refId || body.refId;

    if (status === "PAID") {
      const { error } = await admin.rpc("confirm_payment", { p_payment_id: paymentId, p_gateway_ref: body.transId });
      if (error) throw error;
      await afterPaymentConfirmed(paymentId);
    } else if (status === "CANCELLED") {
      await admin.from("payments").update({ status: "cancelled" }).eq("id", paymentId).eq("status", "pending");
    }
  } catch (e) {
    console.error("[comgate] chyba zpracování", e);
    return new NextResponse("error", { status: 500 }); // Comgate to zkusí znovu
  }
  return new NextResponse("code=0&message=OK", { status: 200 });
}
