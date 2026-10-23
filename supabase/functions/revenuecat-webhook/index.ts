import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const env = (name: string) => Deno.env.get(name) ?? "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
const subscriptionProducts = new Set([
  "outfit_pro_monthly",
  "outfit_pro_yearly",
]);
const subscriptionEvents = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
  "CANCELLATION",
  "EXPIRATION",
  "BILLING_ISSUE",
]);

Deno.serve(async (req) => {
  if (req.method !== "POST")
    return Response.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405 });

  const secret = env("REVENUECAT_WEBHOOK_AUTH");
  if (!secret)
    return Response.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  if (req.headers.get("authorization") !== secret)
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

  try {
    const payload = await req.json();
    const event = payload?.event;
    if (event?.type === "NON_RENEWING_PURCHASE") {
      if (!isUuid(event.app_user_id) || !event.transaction_id)
        return Response.json({ error: "INVALID_EVENT" }, { status: 400 });
      const { error } = await db.rpc("grant_revenuecat_tryons", {
        p_owner: event.app_user_id,
        p_transaction_id: String(event.transaction_id),
        p_product_id: String(event.product_id ?? ""),
      });
      if (error) throw error;
      return Response.json({ ok: true });
    }

    if (!subscriptionEvents.has(event?.type))
      return Response.json({ ok: true });
    if (
      !isUuid(event.app_user_id) ||
      typeof event.id !== "string" ||
      !subscriptionProducts.has(event.product_id) ||
      !Number.isFinite(Number(event.expiration_at_ms))
    )
      return Response.json({ error: "INVALID_EVENT" }, { status: 400 });

    const { error } = await db.rpc("apply_revenuecat_subscription_event", {
      p_owner: event.app_user_id,
      p_event_id: event.id,
      p_event_type: event.type,
      p_product_id: event.product_id,
      p_expires_at: new Date(Number(event.expiration_at_ms)).toISOString(),
      p_period_type: event.period_type === "TRIAL" ? "TRIAL" : "NORMAL",
    });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: "PURCHASE_PROCESSING_FAILED" },
      { status: 500 },
    );
  }
});
