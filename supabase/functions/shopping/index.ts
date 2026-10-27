import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { readRequestJson, uuid } from "../_shared/domain.ts";
import { verifiedRetailerUrl } from "../../../src/lib/shopping-domain.ts";
import { trustedClientIp } from "../../../src/lib/trusted-client-ip.ts";
const env = (name: string) => Deno.env.get(name) ?? "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "",
    allowed = env("ALLOWED_ORIGINS").split(",");
  const headers = {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : "null",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  const reply = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers });
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  try {
    if (req.method !== "POST") throw new Error("INVALID_REQUEST");
    const body = await readRequestJson(req);
    if (
      body.action !== "outbound" ||
      typeof body.product !== "string" ||
      !uuid(body.requestId)
    )
      throw new Error("INVALID_REQUEST");
    const { data: product, error } = await db
      .from("products")
      .select("*")
      .eq("id", body.product)
      .eq("published", true)
      .single();
    if (error || !product) throw new Error("NOT_FOUND");
    if (product.is_demo) throw new Error("DEMO_PRODUCT");
    if (
      !product.expires_at ||
      Date.parse(product.expires_at) <= Date.now() ||
      product.availability === "out_of_stock"
    )
      throw new Error("NOT_FOUND");
    const { data: retailer, error: retailerError } = await db
      .from("catalog_retailers")
      .select("*")
      .eq("id", product.retailer_id)
      .eq("active", true)
      .eq("is_demo", false)
      .single();
    if (retailerError || !retailer) throw new Error("NOT_FOUND");
    if (!retailer.feed_source || !retailer.permission_evidence)
      throw new Error("NOT_FOUND");
    const canonical = verifiedRetailerUrl(product.product_url, [
      retailer.domain,
    ]);
    const affiliate = !!(
      product.affiliate_approved &&
      retailer.affiliate_approved &&
      product.affiliate_url
    );
    const destination = affiliate
      ? verifiedRetailerUrl(product.affiliate_url, retailer.affiliate_hosts)
      : canonical;
    const clientIp = trustedClientIp(req.headers);
    if (clientIp) {
      const bytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          env("TRYON_WORKER_SECRET") + ":shopping:" + clientIp,
        ),
      );
      const key = Array.from(new Uint8Array(bytes), (x) =>
        x.toString(16).padStart(2, "0"),
      ).join("");
      const limited = await db.rpc("battle_rate", {
        p_key: "shopping:" + key,
        p_max: 120,
      });
      if (limited.error) throw new Error("RATE_LIMIT");
    }
    const clicked = await db.from("affiliate_clicks").upsert(
      {
        request_id: body.requestId,
        product_id: product.id,
        retailer_id: retailer.id,
        used_affiliate: affiliate,
      },
      { onConflict: "request_id", ignoreDuplicates: true },
    );
    if (clicked.error) throw new Error("REQUEST_FAILED");
    return reply({ url: destination, affiliate, retailer: retailer.name });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code = [
      "INVALID_REQUEST",
      "NOT_FOUND",
      "DEMO_PRODUCT",
      "RATE_LIMIT",
    ].includes(message)
      ? message
      : "REQUEST_FAILED";
    return reply({ error: code }, code === "RATE_LIMIT" ? 429 : 400);
  }
});
