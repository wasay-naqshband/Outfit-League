import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { readRequestJson, uuid } from "../_shared/domain.ts";
import { cleanupAccounts } from "../_shared/account-cleanup.ts";
const env = (name: string) => Deno.env.get(name) ?? "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
function checked<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error("REQUEST_FAILED");
  return r.data;
}
Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const headers = {
    "Access-Control-Allow-Origin": env("ALLOWED_ORIGINS")
      .split(",")
      .includes(origin)
      ? origin
      : "null",
    "Access-Control-Allow-Headers":
      "authorization,apikey,content-type,x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
  const reply = (value: unknown, status = 200) =>
    Response.json(value, { headers, status });
  if (req.method === "OPTIONS")
    return new Response(null, { headers, status: 204 });
  try {
    if (req.method !== "POST") throw new Error("INVALID_REQUEST");
    const body = await readRequestJson(req);
    if (body.action === "reconcile") {
      if (
        !env("TRYON_WORKER_SECRET") ||
        req.headers.get("x-worker-secret") !== env("TRYON_WORKER_SECRET")
      )
        throw new Error("UNAUTHORIZED");
      return reply({ processed: await cleanupAccounts(db) });
    }
    const token =
      req.headers.get("authorization")?.replace(/^Bearer /i, "") ?? "";
    const auth = await db.auth.getUser(token),
      user = auth.data.user;
    if (auth.error || !user) throw new Error("UNAUTHORIZED");
    const profile = checked(
      await db
        .from("profiles")
        .select("deleting_at")
        .eq("id", user.id)
        .single(),
    );
    if (!profile || profile.deleting_at) throw new Error("UNAUTHORIZED");
    if (body.action === "delete") {
      if (body.confirmation !== "DELETE") throw new Error("INVALID_REQUEST");
      // auth.getUser validated the token first. Require a newly issued access token
      // after password re-entry in the client; ordinary refresh alone is insufficient.
      const claims = JSON.parse(
        atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      const sessions = checked(
        await db.rpc("account_recent_signin", {
          p_owner: user.id,
          p_session: claims.session_id,
        }),
      );
      if (!sessions) throw new Error("REAUTH_REQUIRED");
      const bytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          env("TRYON_WORKER_SECRET") + ":user:" + user.id,
        ),
      );
      const voterKey = Array.from(new Uint8Array(bytes), (x) =>
        x.toString(16).padStart(2, "0"),
      ).join("");
      const result = await db.rpc("request_account_deletion", {
        p_owner: user.id,
        p_voter_key: voterKey,
      });
      if (result.error)
        throw new Error(
          result.error.message.includes("ACTIVE_JOB")
            ? "ACTIVE_JOB"
            : "REQUEST_FAILED",
        );
      await db.auth.admin.updateUserById(user.id, { ban_duration: "876000h" });
      return reply({ accepted: true });
    }
    // This iPhone's push token (or forget it on sign-out). A token moves to
    // whoever signed in on that phone last.
    if (body.action === "push-token") {
      const push = String(body.token ?? "");
      if (!/^ExponentPushToken\[[A-Za-z0-9_-]+\]$/.test(push))
        throw new Error("INVALID_REQUEST");
      checked(
        body.remove === true
          ? await db.from("push_tokens").delete().eq("token", push)
          : await db.from("push_tokens").upsert({
              token: push,
              owner_id: user.id,
              updated_at: new Date().toISOString(),
            }),
      );
      return reply({ saved: true });
    }
    const moderator = checked(
      await db
        .from("moderators")
        .select("owner_id")
        .eq("owner_id", user.id)
        .maybeSingle(),
    );
    if (!moderator) throw new Error("FORBIDDEN");
    if (body.action === "reports") {
      const reports = checked(
        await db
          .from("battle_reports")
          .select("battle_id,reason,created_at")
          .order("created_at", { ascending: false })
          .limit(50),
      );
      const ids = [...new Set((reports ?? []).map((x) => x.battle_id))];
      const battles = ids.length
        ? checked(
            await db.from("battles").select("id,title,status").in("id", ids),
          )
        : [];
      // Reported comments, most reported first (two reports hide one).
      const flagged = checked(
        await db
          .from("battle_comment_reports")
          .select("comment_id,created_at")
          .order("created_at", { ascending: false })
          .limit(200),
      );
      const counts = new Map<number, number>();
      for (const r of flagged ?? [])
        counts.set(r.comment_id, (counts.get(r.comment_id) ?? 0) + 1);
      const comments = counts.size
        ? (
            checked(
              await db
                .from("battle_comments")
                .select("id,battle_id,display_name,body,hidden")
                .in("id", [...counts.keys()]),
            ) ?? []
          )
            .map((c) => ({ ...c, reports: counts.get(c.id) ?? 0 }))
            .sort((a, b) => b.reports - a.reports)
        : [];
      return reply({ reports, battles, comments });
    }
    if (body.action === "remove-comment" && Number.isSafeInteger(body.id)) {
      checked(await db.from("battle_comments").delete().eq("id", body.id));
      return reply({ removed: true });
    }
    if (body.action === "hide" && uuid(body.id)) {
      checked(
        await db.rpc("hide_reported_battle", {
          p_moderator: user.id,
          p_battle: body.id,
        }),
      );
      return reply({ hidden: true });
    }
    throw new Error("INVALID_REQUEST");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code = [
      "UNAUTHORIZED",
      "FORBIDDEN",
      "INVALID_REQUEST",
      "REAUTH_REQUIRED",
      "ACTIVE_JOB",
    ].includes(message)
      ? message
      : "REQUEST_FAILED";
    return reply(
      { error: code },
      code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : 400,
    );
  }
});
