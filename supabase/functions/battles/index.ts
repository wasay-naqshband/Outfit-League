import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import {
  readRequestJson,
  uuid,
  validateJpeg,
  MAX_IMAGE_BYTES,
} from "../_shared/domain.ts";
const env = (key: string) => Deno.env.get(key) ?? "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
function checked<T>(value: { data: T; error: { message: string } | null }): T {
  if (value.error) throw new Error(value.error.message);
  return value.data;
}
const rpc = async (name: string, args: Record<string, unknown>) =>
  checked(await db.rpc(name, args));
async function hash(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(env("TRYON_WORKER_SECRET") + ":" + value),
  );
  return Array.from(new Uint8Array(bytes), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}
async function copySource(
  battle: string,
  side: "a" | "b",
  kind: string,
  id: string,
  owner: string,
) {
  let path: string | null = null,
    sample: string | null = null,
    label = "",
    sourceBucket = "";
  if (kind === "library") {
    const item = checked(
      await db
        .from("library_items")
        .select("photo_path,explore_image,name")
        .eq("id", id)
        .eq("owner_id", owner)
        .single(),
    );
    if (!item) throw new Error("INVALID_SOURCE");
    path = item.photo_path;
    sample = path ? null : item.explore_image;
    label = sample ? "Sample illustration" : "Closet photo";
    sourceBucket = "library-private";
  } else {
    const job = checked(
      await db
        .from("try_on_jobs")
        .select("result_asset_id")
        .eq("id", id)
        .eq("owner_id", owner)
        .eq("status", "completed")
        .single(),
    );
    if (!job) throw new Error("INVALID_SOURCE");
    const asset = checked(
      await db
        .from("private_assets")
        .select("path")
        .eq("id", job.result_asset_id)
        .eq("owner_id", owner)
        .eq("kind", "result")
        .single(),
    );
    if (!asset) throw new Error("INVALID_SOURCE");
    path = asset.path;
    label = "AI preview";
    sourceBucket = "tryon-private";
  }
  if (!path && !sample) throw new Error("INVALID_SOURCE");
  const target = path ? `${battle}/${side}.jpg` : null;
  if (path) {
    const data = checked(await db.storage.from(sourceBucket).download(path));
    if (!data || data.size > MAX_IMAGE_BYTES) throw new Error("INVALID_SOURCE");
    const bytes = new Uint8Array(await data.arrayBuffer());
    validateJpeg(bytes);
    const uploaded = await db.storage
      .from("battle-images")
      .upload(target!, bytes, {
        contentType: "image/jpeg",
        cacheControl: "0",
        upsert: false,
      });
    if (
      uploaded.error &&
      !["409", "Duplicate"].includes(
        String("statusCode" in uploaded.error ? uploaded.error.statusCode : ""),
      )
    ) {
      // A retry may find a completed immutable snapshot from its previous attempt.
      const existing = await db.storage.from("battle-images").download(target!);
      if (existing.error || !existing.data) throw new Error("INVALID_SOURCE");
    }
  }
  return {
    [`${side}_path`]: target,
    [`${side}_sample`]: sample,
    [`${side}_label`]: label.slice(0, 100),
  };
}
async function view(
  id: string,
  owner: string | null,
  key: string,
  after: number,
) {
  const row = checked(
    await db.from("battles").select("*").eq("id", id).single(),
  );
  if (
    !row ||
    (row.owner_id !== owner && !["published", "closed"].includes(row.status))
  )
    throw new Error("NOT_FOUND");
  const url = async (path: string | null) =>
    path
      ? (checked(
          await db.storage.from("battle-images").createSignedUrl(path, 60),
        )?.signedUrl ?? null)
      : null;
  const [aUrl, bUrl, counts, mine] = await Promise.all([
    url(row.a_path),
    url(row.b_path),
    rpc("battle_counts", { p_id: id }),
    db
      .from("battle_votes")
      .select("choice")
      .eq("battle_id", id)
      .eq("voter_key", key)
      .maybeSingle(),
  ]);
  let voters: unknown[] = [];
  if (
    row.voting_mode === "public" &&
    ["published", "closed"].includes(row.status)
  )
    voters =
      checked(
        await db
          .from("battle_votes")
          .select("id,choice,display_name")
          .eq("battle_id", id)
          .gt("id", after)
          .order("id")
          .limit(40),
      ) ?? [];
  return {
    id: row.id,
    title: row.title,
    mode: row.voting_mode,
    status: row.status,
    ready: row.ready,
    isOwner: row.owner_id === owner,
    aUrl,
    bUrl,
    aSample: row.a_sample,
    bSample: row.b_sample,
    aLabel: row.a_label,
    bLabel: row.b_label,
    counts,
    mine: checked(mine)?.choice ?? null,
    voters,
  };
}
Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "",
    allowed = env("ALLOWED_ORIGINS").split(",").filter(Boolean);
  const headers = {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : "null",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  const reply = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers });
  try {
    if (req.method !== "POST") return reply({ error: "INVALID_REQUEST" }, 405);
    const body = await readRequestJson(req);
    if (!uuid(body.token)) throw new Error("INVALID_REQUEST");
    let owner: string | null = null;
    const bearer = req.headers.get("authorization")?.replace(/^Bearer /i, "");
    if (bearer) {
      const user = await db.auth.getUser(bearer);
      owner = user.data.user?.id ?? null;
      if (owner) {
        const profile = checked(
          await db
            .from("profiles")
            .select("deleting_at")
            .eq("id", owner)
            .maybeSingle(),
        );
        if (!profile || profile.deleting_at) throw new Error("UNAUTHORIZED");
      }
    }
    const key = await hash(owner ? "user:" + owner : "browser:" + body.token);
    const id = body.id;
    if (!uuid(id)) throw new Error("INVALID_REQUEST");
    if (body.action === "view")
      return reply(
        await view(
          id,
          owner,
          key,
          typeof body.after === "number" &&
            Number.isSafeInteger(body.after) &&
            body.after >= 0
            ? body.after
            : 0,
        ),
      );
    // Gateway-provided network header is used only as an additional abuse limit;
    // no IP address is persisted or returned to callers.
    const network = await hash(
      "network:" +
        (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "unknown"),
    );
    await rpc("battle_rate", { p_key: "network:" + network, p_max: 120 });
    if (body.action === "create") {
      if (!owner) throw new Error("UNAUTHORIZED");
      if (
        typeof body.title !== "string" ||
        body.title.trim().length < 1 ||
        body.title.length > 100 ||
        !["anonymous", "public"].includes(String(body.mode)) ||
        !uuid(body.aId) ||
        !uuid(body.bId) ||
        !["library", "job"].includes(String(body.aKind)) ||
        !["library", "job"].includes(String(body.bKind))
      )
        throw new Error("INVALID_REQUEST");
      await rpc("create_battle", {
        p_owner: owner,
        p_id: id,
        p_title: body.title,
        p_mode: body.mode,
        p_a_kind: body.aKind,
        p_a: body.aId,
        p_b_kind: body.bKind,
        p_b: body.bId,
      });
      const row = checked(
        await db
          .from("battles")
          .select("*")
          .eq("id", id)
          .eq("owner_id", owner)
          .single(),
      );
      if (row && row.status === "draft" && !row.ready) {
        const [a, b] = await Promise.all([
          copySource(id, "a", row.source_a_kind, row.source_a_id, owner),
          copySource(id, "b", row.source_b_kind, row.source_b_id, owner),
        ]);
        checked(
          await db
            .from("battles")
            .update({ ...a, ...b, ready: true })
            .eq("id", id)
            .eq("status", "draft")
            .eq("ready", false),
        );
      }
      return reply(await view(id, owner, key, 0));
    }
    if (["publish", "close", "unpublish"].includes(String(body.action))) {
      if (!owner) throw new Error("UNAUTHORIZED");
      if (body.action === "publish" && body.consent !== true)
        throw new Error("PUBLISH_CONSENT_REQUIRED");
      await rpc("manage_battle", {
        p_owner: owner,
        p_id: id,
        p_action: body.action,
      });
      return reply(await view(id, owner, key, 0));
    }
    if (body.action === "vote") {
      if (!["A", "B"].includes(String(body.choice)))
        throw new Error("INVALID_REQUEST");
      await rpc("cast_battle_vote", {
        p_id: id,
        p_key: key,
        p_choice: body.choice,
        p_name: typeof body.name === "string" ? body.name.slice(0, 40) : null,
        p_authenticated: !!owner && body.publicConsent === true,
      });
      return reply(await view(id, owner, key, 0));
    }
    if (body.action === "report") {
      if (
        ![
          "Inappropriate image",
          "Harassment",
          "Privacy concern",
          "Other",
        ].includes(String(body.reason))
      )
        throw new Error("INVALID_REQUEST");
      await rpc("report_battle", {
        p_id: id,
        p_key: await hash("report:" + network),
        p_reason: body.reason,
      });
      return reply({ reported: true });
    }
    throw new Error("INVALID_REQUEST");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code = [
      "INVALID_REQUEST",
      "UNAUTHORIZED",
      "NOT_FOUND",
      "INVALID_SOURCE",
      "RATE_LIMIT",
      "PUBLIC_IDENTITY_REQUIRED",
      "VOTING_CLOSED",
      "PUBLISH_CONSENT_REQUIRED",
      "INVALID_STATE",
    ].includes(message)
      ? message
      : "REQUEST_FAILED";
    return reply(
      { error: code },
      code === "UNAUTHORIZED"
        ? 401
        : code === "NOT_FOUND"
          ? 404
          : code === "RATE_LIMIT"
            ? 429
            : 400,
    );
  }
});
