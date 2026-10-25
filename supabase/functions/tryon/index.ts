import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import {
  CONSENT_VERSION,
  decodeResult,
  MAX_IMAGE_BYTES,
  terminal,
  toBase64,
  uuid,
  validateJpeg,
  readRequestJson,
} from "../_shared/domain.ts";
import { notify } from "../_shared/push.ts";
import {
  FashnProvider,
  geminiTryOn,
  openAiTryOn,
  outfitPrompt,
} from "../_shared/provider.ts";
import { normalizeResult } from "../_shared/result-image.ts";
import { generateSpinVideo, SPIN_START } from "../_shared/spin.ts";
import { cleanupAccounts } from "../_shared/account-cleanup.ts";
import { linkImage } from "../_shared/link-image.ts";
import {
  lens,
  pieceOptions,
  rank,
  shopping,
  storeLink,
  thumbnail,
  type Lookalike,
} from "../_shared/lookalikes.ts";
import {
  colorAnalysis,
  garmentQuery,
  scoreLookalikes,
  styleOutfit,
  cleanStyled,
  rateFit,
  checkPhoto,
  labelGarment,
  type ClosetItem,
} from "../_shared/stylist.ts";

const env = (name: string) => Deno.env.get(name) ?? "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const bucket = db.storage.from("tryon-private");
const providerName =
  env("TRYON_PROVIDER") === "openai"
    ? "OpenAI"
    : env("TRYON_PROVIDER") === "fashn"
      ? "FASHN"
      : "Gemini";
// One synchronous image edit; FASHN is the only polled provider.
const editors = { Gemini: geminiTryOn, OpenAI: openAiTryOn };
const providers = {
  FASHN: new FashnProvider(env("FASHN_API_KEY")),
};
const providerKey = (name: string) =>
  env(
    name === "Gemini"
      ? "GEMINI_API_KEY"
      : name === "OpenAI"
        ? "OPENAI_API_KEY"
        : "FASHN_API_KEY",
  );
const spinEnabled = () => !!env("GEMINI_API_KEY");
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
type Spin = {
  id: string;
  owner_id: string;
  job_id: string;
  sheet_asset_id: string | null;
  status: string;
  error_code: string | null;
  created_at: string;
};
const enabled = () =>
  env("LIVE_TRYON_ENABLED") === "true" && !!providerKey(providerName);
type Job = {
  id: string;
  owner_id: string;
  person_asset_id: string;
  garment_asset_id: string | null;
  outfit: string | null;
  extra_garments: string[];
  garment_parts: string[];
  result_asset_id: string | null;
  rating: unknown;
  lookalikes: Lookalike[] | null;
  status: string;
  provider_id: string | null;
  expires_at: string;
  updated_at: string;
};
type Asset = {
  id: string;
  owner_id: string;
  path: string;
  kind: string;
  byte_size: number;
};
const checked = <T>(result: {
  data: T;
  error: { message: string } | null;
}): T => {
  if (result.error) throw new Error(result.error.message);
  return result.data;
};
const required = <T>(result: {
  data: T;
  error: { message: string } | null;
}): NonNullable<T> => {
  const value = checked(result);
  if (value == null) throw new Error("NOT_FOUND");
  return value;
};
async function rpc(name: string, args: Record<string, unknown>) {
  return checked(await db.rpc(name, args));
}
async function ownedJob(id: unknown, owner: string): Promise<Job> {
  if (!uuid(id)) throw new Error("INVALID_REQUEST");
  const job = checked(
    await db
      .from("try_on_jobs")
      .select("*")
      .eq("id", id)
      .eq("owner_id", owner)
      .maybeSingle(),
  );
  if (!job) throw new Error("NOT_FOUND");
  return job;
}
async function readInput(id: string, owner: string): Promise<string> {
  const asset: Asset = required(
    await db
      .from("private_assets")
      .select("*")
      .eq("id", id)
      .eq("owner_id", owner)
      .single(),
  );
  const blob = checked(await bucket.download(asset.path));
  if (!blob || blob.size !== asset.byte_size || blob.size > MAX_IMAGE_BYTES)
    throw new Error("INVALID_IMAGE");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  validateJpeg(bytes);
  return "data:image/jpeg;base64," + toBase64(bytes);
}
// Saves the finished image as the job's private result and settles the credit.
async function storeResult(job: Job, bytes: Uint8Array) {
  const path = job.owner_id + "/" + job.id + ".jpg";
  // Deterministic path + overwrite=false make concurrent polling safe.
  const upload = await bucket.upload(path, bytes, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (upload.error && String(upload.error.statusCode) !== "409")
    throw new Error("STORE_RESULT_FAILED");
  checked(
    await db.from("private_assets").upsert(
      {
        id: job.id,
        owner_id: job.owner_id,
        kind: "result",
        path,
        byte_size: bytes.length,
        content_type: "image/jpeg",
      },
      { onConflict: "id", ignoreDuplicates: true },
    ),
  );
  await rpc("finish_tryon", { p_job: job.id, p_result: job.id });
}
// Image editors answer in one long call, so it runs after the request returns;
// the app keeps polling "status". A dead worker is refunded when the job expires.
async function runEdit(job: Job, name: "Gemini" | "OpenAI") {
  try {
    const inputs = await Promise.all(
      [job.person_asset_id, job.garment_asset_id, ...job.extra_garments]
        .filter((id): id is string => !!id)
        .map((id) => readInput(id, job.owner_id)),
    );
    const [person, ...garments] = inputs;
    const bytes = await normalizeResult(
      await editors[name](
        providerKey(name),
        person!,
        garments,
        fetch,
        job.outfit ? outfitPrompt(job.outfit) : undefined,
      ),
    );
    validateJpeg(bytes);
    await storeResult(job, bytes);
    await notify(db, job.owner_id, {
      title: "Your look is ready ✨",
      body: job.outfit
        ? "Your stylist’s outfit is on you. Tap to see it and shop the look."
        : "Tap to see it on you.",
      url: "/generation/" + job.id,
      kind: "look_ready",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(name, "try-on failed", job.id, reason);
    const code =
      reason === "PROVIDER_UNAVAILABLE"
        ? "SUBMISSION_FAILED"
        : error instanceof Error &&
            [
              "PROVIDER_BUSY",
              "INVALID_RESULT",
              "INVALID_IMAGE",
              "IMAGE_DIMENSIONS",
            ].includes(error.message)
          ? error.message
          : "GENERATION_FAILED";
    await rpc("finish_tryon", { p_job: job.id, p_error: code }).catch(() => {});
  }
}
async function submitJob(job: Job) {
  if (!enabled()) return; // Remains pending; worker resumes when explicitly enabled.
  const claimed = await rpc("claim_tryon", { p_job: job.id });
  if (!claimed) return;
  if (providerName !== "FASHN") {
    await rpc("attach_prediction", {
      p_job: job.id,
      p_prediction: providerName.toLowerCase() + ":" + job.id,
    });
    EdgeRuntime.waitUntil(runEdit(job, providerName));
    return;
  }
  try {
    // FASHN wears one piece; "start" refuses extra pieces for it.
    const [person, garment] = await Promise.all(
      [job.person_asset_id, job.garment_asset_id!].map((id) =>
        readInput(id, job.owner_id),
      ),
    );
    const prediction = await providers.FASHN.submit(person, garment);
    await rpc("attach_prediction", {
      p_job: job.id,
      p_prediction: prediction,
    });
  } catch (error) {
    // Never resubmit an ambiguous POST. Refund this job rather than risk charging twice.
    const code =
      error instanceof Error &&
      ["INVALID_IMAGE", "IMAGE_DIMENSIONS", "PROVIDER_BUSY"].includes(
        error.message,
      )
        ? error.message
        : "SUBMISSION_FAILED";
    await rpc("finish_tryon", { p_job: job.id, p_error: code });
  }
}
async function syncJob(job: Job) {
  if (terminal(job.status)) return;
  if (Date.parse(job.expires_at) < Date.now()) {
    await rpc("finish_tryon", { p_job: job.id, p_error: "GENERATION_TIMEOUT" });
    return;
  }
  if (job.status === "pending") {
    await submitJob(job);
    return;
  }
  if (!job.provider_id || /^(gemini|openai):/.test(job.provider_id)) return;
  if (!providerKey("FASHN")) return;
  let prediction;
  try {
    prediction = await providers.FASHN.status(job.provider_id);
  } catch (error) {
    if (
      error instanceof Error &&
      ["INVALID_RESULT", "INVALID_IMAGE", "IMAGE_DIMENSIONS"].includes(
        error.message,
      )
    )
      await rpc("finish_tryon", { p_job: job.id, p_error: "INVALID_RESULT" });
    return;
  } // Transient GET failures retain the job and reserve until reconciliation.
  if (prediction.state === "failed") {
    await rpc("finish_tryon", {
      p_job: job.id,
      p_error: prediction.error ?? "GENERATION_FAILED",
    });
  } else if (prediction.state === "completed" && prediction.image) {
    try {
      await storeResult(job, decodeResult(prediction.image));
    } catch (error) {
      if (
        error instanceof Error &&
        ["INVALID_RESULT", "INVALID_IMAGE", "IMAGE_DIMENSIONS"].includes(
          error.message,
        )
      )
        await rpc("finish_tryon", { p_job: job.id, p_error: "INVALID_RESULT" });
      // Storage/network errors retry safely on the next poll.
    }
  } else {
    checked(
      await db
        .from("try_on_jobs")
        .update({
          status: prediction.state,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .in("status", ["queued", "processing"]),
    );
  }
}
async function resultView(job: Job) {
  let spin: Spin | null = checked(
    await db.from("spin_views").select("*").eq("job_id", job.id).maybeSingle(),
  );
  // The worker died or timed out: refund instead of leaving the credit reserved.
  if (
    spin?.status === "processing" &&
    Date.parse(spin.created_at) < Date.now() - 5 * 60000
  )
    spin = await rpc("finish_spin", {
      p_spin: spin.id,
      p_error: "GENERATION_TIMEOUT",
    });
  const ids = [
    job.person_asset_id,
    job.result_asset_id,
    spin?.sheet_asset_id,
  ].filter(Boolean);
  const assets: Asset[] = required(
    await db.from("private_assets").select("*").in("id", ids),
  );
  const signed: Record<string, string> = {};
  for (const asset of assets)
    signed[asset.kind] = required(
      await bucket.createSignedUrl(asset.path, 300),
    ).signedUrl;
  const look = checked(
    await db
      .from("looks")
      .select("id,saved")
      .eq("job_id", job.id)
      .maybeSingle(),
  );
  // Lookalikes go out only through their own action, which applies Free vs Pro.
  return {
    job: { ...job, lookalikes: undefined },
    beforeUrl: signed.person ?? null,
    afterUrl: signed.result ?? null,
    look,
    spin: spin && {
      status: spin.status,
      error: spin.error_code,
      sheetUrl: signed.spin ?? null,
      start: SPIN_START,
    },
  };
}
async function removeJob(job: Job) {
  if (!terminal(job.status)) throw new Error("ACTIVE_JOB");
  const spin: Spin | null = checked(
    await db.from("spin_views").select("*").eq("job_id", job.id).maybeSingle(),
  );
  if (spin?.status === "processing") throw new Error("ACTIVE_JOB");
  const ids = [
    job.person_asset_id,
    job.garment_asset_id,
    ...job.extra_garments,
    job.result_asset_id,
    spin?.sheet_asset_id,
  ].filter(Boolean);
  const assets: Asset[] = required(
    await db.from("private_assets").select("*").in("id", ids),
  );
  checked(await bucket.remove(assets.map((asset) => asset.path)));
  checked(
    await db
      .from("try_on_jobs")
      .delete()
      .eq("id", job.id)
      .eq("owner_id", job.owner_id),
  );
  checked(
    await db
      .from("private_assets")
      .delete()
      .in("id", ids)
      .eq("owner_id", job.owner_id),
  );
}
async function makeSpin(job: Job, spin: Spin) {
  try {
    const bytes = await generateSpinVideo(
      env("GEMINI_API_KEY"),
      await readInput(job.result_asset_id!, job.owner_id),
    );
    const id = crypto.randomUUID(),
      path = job.owner_id + "/" + id + ".mp4";
    const upload = await bucket.upload(path, bytes, {
      contentType: "video/mp4",
      upsert: false,
    });
    if (upload.error) throw new Error("STORE_RESULT_FAILED");
    checked(
      await db.from("private_assets").insert({
        id,
        owner_id: job.owner_id,
        kind: "spin",
        path,
        byte_size: bytes.length,
        content_type: "video/mp4",
      }),
    );
    await rpc("finish_spin", { p_spin: spin.id, p_sheet: id });
    await notify(db, job.owner_id, {
      title: "Your 360° view is ready 🔄",
      body: "Spin your look all the way round.",
      url: "/generation/" + job.id,
      kind: "look_ready",
    });
  } catch (error) {
    const code =
      error instanceof Error &&
      ["PROVIDER_BUSY", "INVALID_RESULT", "IMAGE_DIMENSIONS"].includes(
        error.message,
      )
        ? error.message
        : "GENERATION_FAILED";
    await rpc("finish_spin", { p_spin: spin.id, p_error: code }).catch(
      () => {},
    );
  }
}
// Lens (what looks the same) + shopping (US prices), then an AI score keeps
// only close matches. Each search is best-effort; scoring failure falls back
// to cheapest first.
async function findLookalikes(job: Job): Promise<Lookalike[]> {
  const gemini = env("GEMINI_API_KEY"),
    serper = env("SERPER_API_KEY");
  // Styled outfits have no clothing photo to search with.
  if (!job.garment_asset_id) throw new Error("NOT_FOUND");
  const garment = await readInput(job.garment_asset_id, job.owner_id);
  const asset: Asset = required(
    await db
      .from("private_assets")
      .select("*")
      .eq("id", job.garment_asset_id)
      .single(),
  );
  // Lens fetches the photo itself: a private link that expires in 5 minutes.
  const signed = required(await bucket.createSignedUrl(asset.path, 300));
  const [query, visual] = await Promise.all([
    garmentQuery(gemini, garment),
    lens(serper, signed.signedUrl).catch(() => ({ items: [], queries: [] })),
  ]);
  const seen = new Set<string>();
  const priced = await Promise.all(
    [query, ...visual.queries].map((q) => shopping(serper, q).catch(() => [])),
  );
  // Visual matches first (closest look), then up to 8 priced results per query.
  const candidates = [
    ...visual.items.slice(0, 8),
    ...priced.flatMap((list) => list.slice(0, 8)),
  ]
    .filter((item) => !seen.has(item.url) && !!seen.add(item.url))
    .slice(0, 24);
  const photos = await Promise.all(candidates.map((c) => thumbnail(c.image)));
  const scorable = candidates.filter((_, i) => photos[i]);
  const scores = await scoreLookalikes(
    gemini,
    garment,
    photos.filter((p): p is { mime: string; data: string } => !!p),
  ).catch(() => null);
  return rank(
    scores
      ? scorable.map((item, i) => ({ ...item, score: scores[i] }))
      : candidates,
  );
}
// The photo check runs before a credit is reserved. It fails open: a checker
// outage or an unreadable answer never blocks a try-on.
async function photoProblem(owner: string, person: string) {
  const key = env("GEMINI_API_KEY");
  if (!key) return null;
  return await readInput(person, owner)
    .then((uri) => checkPhoto(key, uri))
    .catch(() => null);
}
async function hasPro(owner: string) {
  const subscription = checked(
    await db
      .from("user_subscriptions")
      .select("active,expires_at")
      .eq("owner_id", owner)
      .maybeSingle(),
  ) as { active: boolean; expires_at: string } | null;
  return (
    !!subscription?.active && Date.parse(subscription.expires_at) > Date.now()
  );
}
function cors(req: Request) {
  const origin = req.headers.get("origin");
  const allowed = env("ALLOWED_ORIGINS").split(",").filter(Boolean);
  return {
    "Access-Control-Allow-Origin":
      origin && allowed.includes(origin) ? origin : "null",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info, x-worker-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}
const exposed = new Set([
  "INVALID_REQUEST",
  "INVALID_IMAGE",
  "IMAGE_DIMENSIONS",
  "NOT_FOUND",
  "UNAUTHORIZED",
  "CONSENT_REQUIRED",
  "INVALID_ASSETS",
  "NO_CREDITS",
  "ACTIVE_JOB",
  "RATE_LIMIT",
  "IDEMPOTENCY_CONFLICT",
  "PROVIDER_NOT_CONFIGURED",
  "PROVIDER_BUSY",
  "LINK_FAILED",
  "LINK_NO_IMAGE",
  "PRO_REQUIRED",
  "STYLIST_FAILED",
  "LOOKALIKES_UNAVAILABLE",
  "LOOKALIKES_FAILED",
  "NO_SAVED_PHOTO",
  "PHOTO_NO_PERSON",
  "PHOTO_GROUP",
  "PHOTO_SELFIE",
  "PHOTO_CLOSE_UP",
  "PHOTO_UNCLEAR",
]);
Deno.serve(async (req) => {
  const headers = cors(req);
  const reply = (data: unknown, status = 200) =>
    Response.json(data, { status, headers });
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply({ error: "INVALID_REQUEST" }, 405);
  try {
    const body = await readRequestJson(req);
    if (body.action === "reconcile") {
      if (
        !env("TRYON_WORKER_SECRET") ||
        req.headers.get("x-worker-secret") !== env("TRYON_WORKER_SECRET")
      )
        throw new Error("UNAUTHORIZED");
      await cleanupAccounts(db);
      const jobs: Job[] = required(
        await db
          .from("try_on_jobs")
          .select("*")
          .in("status", ["pending", "submitting", "queued", "processing"])
          .order("created_at")
          .limit(5),
      );
      for (const job of jobs) await syncJob(job);
      const libraryPaths: { path: string }[] = checked(
        await db.rpc("library_cleanup_paths"),
      );
      if (libraryPaths.length) {
        checked(
          await db.storage
            .from("library-private")
            .remove(libraryPaths.map((item) => item.path)),
        );
        checked(
          await db
            .from("library_cleanup")
            .delete()
            .in(
              "path",
              libraryPaths.map((item) => item.path),
            ),
        );
      }
      // Remove abandoned input uploads after one day. Never touch a job's inputs.
      const old: Asset[] = required(
        await db
          .from("private_assets")
          .select("*")
          .lt("created_at", new Date(Date.now() - 86400000).toISOString())
          .neq("kind", "spin")
          .limit(50),
      );
      for (const asset of old) {
        const used = required(
          await db
            .from("try_on_jobs")
            .select("id")
            .or(
              "person_asset_id.eq." +
                asset.id +
                ",garment_asset_id.eq." +
                asset.id +
                ",result_asset_id.eq." +
                asset.id +
                ",extra_garments.cs.{" +
                asset.id +
                "}",
            )
            .limit(1),
        );
        if (!used.length) {
          checked(await bucket.remove([asset.path]));
          checked(await db.from("private_assets").delete().eq("id", asset.id));
        }
      }
      return reply({ reconciled: jobs.length });
    }
    const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
    if (!token) throw new Error("UNAUTHORIZED");
    const auth = await db.auth.getUser(token);
    if (auth.error || !auth.data.user) throw new Error("UNAUTHORIZED");
    const owner = auth.data.user.id;
    const profile = checked(
      await db.from("profiles").select("deleting_at").eq("id", owner).single(),
    );
    if (!profile || profile.deleting_at) throw new Error("UNAUTHORIZED");
    if (body.action === "config")
      return reply({
        enabled: enabled(),
        spinEnabled: spinEnabled(),
        provider: providerName === "Gemini" ? "Google Gemini" : providerName,
        consentVersion: CONSENT_VERSION,
        maxImageBytes: MAX_IMAGE_BYTES,
      });
    if (body.action === "upload") {
      if (
        typeof body.kind !== "string" ||
        !["person", "garment"].includes(body.kind) ||
        typeof body.size !== "number" ||
        !Number.isInteger(body.size) ||
        body.size < 1 ||
        body.size > MAX_IMAGE_BYTES
      )
        throw new Error("INVALID_REQUEST");
      const id = crypto.randomUUID(),
        path = owner + "/" + id + ".jpg";
      await rpc("register_tryon_upload", {
        p_owner: owner,
        p_id: id,
        p_kind: body.kind,
        p_size: body.size,
      });
      const signed = required(
        await bucket.createSignedUploadUrl(path, { upsert: false }),
      );
      return reply({ id, path, token: signed.token });
    }
    if (body.action === "remove-upload") {
      if (!uuid(body.id)) throw new Error("INVALID_REQUEST");
      const asset = checked(
        await db
          .from("private_assets")
          .select("*")
          .eq("id", body.id)
          .eq("owner_id", owner)
          .maybeSingle(),
      );
      if (!asset) return reply({ deleted: true });
      const used = required(
        await db
          .from("try_on_jobs")
          .select("id")
          .or(
            "person_asset_id.eq." +
              asset.id +
              ",garment_asset_id.eq." +
              asset.id +
              ",result_asset_id.eq." +
              asset.id +
              ",extra_garments.cs.{" +
              asset.id +
              "}",
          )
          .limit(1),
      );
      if (used.length || asset.kind === "result") throw new Error("ACTIVE_JOB");
      checked(await bucket.remove([asset.path]));
      checked(await db.from("private_assets").delete().eq("id", asset.id));
      return reply({ deleted: true });
    }
    if (body.action === "start") {
      if (!enabled()) throw new Error("PROVIDER_NOT_CONFIGURED");
      const extra = body.extra ?? [],
        parts = body.parts ?? [];
      // A styled outfit arrives as text instead of a clothing photo.
      const outfit =
        typeof body.outfit === "string" ? body.outfit.trim() : null;
      if (
        !uuid(body.key) ||
        !uuid(body.person) ||
        (outfit
          ? body.garment != null ||
            outfit.length < 10 ||
            outfit.length > 2000 ||
            providerName === "FASHN"
          : !uuid(body.garment)) ||
        body.consent !== CONSENT_VERSION ||
        !Array.isArray(extra) ||
        extra.length > 2 ||
        !extra.every(uuid) ||
        !Array.isArray(parts) ||
        !parts.every((part) => ["top", "bottom", "outer"].includes(part)) ||
        // FASHN wears only one piece at a time.
        (extra.length && providerName === "FASHN")
      )
        throw new Error("INVALID_REQUEST");
      const problem = await photoProblem(owner, body.person);
      if (problem) throw new Error(problem);
      const reserved = await rpc("reserve_tryon", {
        p_owner: owner,
        p_key: body.key,
        p_person: body.person,
        p_garment: outfit ? null : body.garment,
        p_consent: body.consent,
        p_extra: extra,
        p_parts: parts,
        p_outfit: outfit,
      });
      if (reserved.created && outfit)
        checked(
          await db
            .from("try_on_jobs")
            .update({ styled: cleanStyled(body.styled) })
            .eq("id", reserved.job.id),
        );
      if (reserved.created) await submitJob(reserved.job);
      return reply(await resultView(await ownedJob(reserved.job.id, owner)));
    }
    if (body.action === "status") {
      const job = await ownedJob(body.id, owner);
      await syncJob(job);
      return reply(await resultView(await ownedJob(job.id, owner)));
    }
    if (body.action === "spin") {
      if (!spinEnabled()) throw new Error("PROVIDER_NOT_CONFIGURED");
      const job = await ownedJob(body.id, owner);
      const reserved = await rpc("reserve_spin", {
        p_owner: owner,
        p_job: job.id,
      });
      // Generation outlives this request; the app polls "status" for the result.
      if (reserved.created) EdgeRuntime.waitUntil(makeSpin(job, reserved.spin));
      return reply(await resultView(job));
    }
    if (body.action === "lookalikes" || body.action === "lookalike-link") {
      const serper = env("SERPER_API_KEY");
      if (!env("SERPER_API_KEY") || !env("GEMINI_API_KEY"))
        throw new Error("LOOKALIKES_UNAVAILABLE");
      const job = await ownedJob(body.id, owner);
      if (job.status !== "completed") throw new Error("NOT_FOUND");
      let items = job.lookalikes;
      if (!items) {
        await rpc("battle_rate", { p_key: "lookalike:" + owner, p_max: 30 });
        items = await findLookalikes(job);
        checked(
          await db
            .from("try_on_jobs")
            .update({ lookalikes: items })
            .eq("id", job.id),
        );
      }
      // Free shows the two cheapest; Pro sees them all.
      const shown = (await hasPro(owner)) ? items.length : 2;
      if (body.action === "lookalikes")
        return reply({
          items: items.slice(0, shown),
          locked: Math.max(0, items.length - shown),
        });
      const index = Number(body.index);
      const item = items.slice(0, shown)[index];
      if (!item) throw new Error("NOT_FOUND");
      await rpc("battle_rate", { p_key: "link:" + owner, p_max: 60 });
      const url = await storeLink(serper, item).catch(() => item.url);
      if (url !== item.url) {
        items[index] = { ...item, url };
        checked(
          await db
            .from("try_on_jobs")
            .update({ lookalikes: items })
            .eq("id", job.id),
        );
      }
      return reply({ url });
    }
    if (body.action === "shop-piece" || body.action === "piece-link") {
      const serper = env("SERPER_API_KEY");
      if (!serper) throw new Error("LOOKALIKES_UNAVAILABLE");
      await rpc("battle_rate", { p_key: "shop:" + owner, p_max: 60 });
      if (body.action === "piece-link") {
        const item = body.item as Record<string, unknown> | null;
        const url = typeof item?.url === "string" ? item.url : "";
        if (!url.startsWith("https://") || url.length > 2048)
          throw new Error("INVALID_REQUEST");
        return reply({
          url: await storeLink(serper, {
            title: String(item!.title ?? "").slice(0, 120),
            store: String(item!.store ?? "").slice(0, 60),
            price: null,
            url,
            image: url,
          }).catch(() => url),
        });
      }
      const query = typeof body.query === "string" ? body.query.trim() : "";
      if (!query || query.length > 100) throw new Error("INVALID_REQUEST");
      return reply({
        items: pieceOptions(
          await shopping(serper, query).catch(() => [] as Lookalike[]),
        ),
      });
    }
    if (body.action === "link") {
      if (!(await hasPro(owner))) throw new Error("PRO_REQUIRED");
      await rpc("battle_rate", { p_key: "link:" + owner, p_max: 30 });
      const photo = await linkImage(body.url).catch((error) => {
        throw new Error(
          error instanceof Error && error.message === "LINK_NO_IMAGE"
            ? "LINK_NO_IMAGE"
            : "LINK_FAILED",
        );
      });
      return reply({ type: photo.type, data: toBase64(photo.data) });
    }
    if (["rate", "colors", "outfit", "label"].includes(String(body.action))) {
      if (!env("GEMINI_API_KEY")) throw new Error("PROVIDER_NOT_CONFIGURED");
      const key = env("GEMINI_API_KEY");
      if (body.action === "rate") {
        const job = await ownedJob(body.id, owner);
        if (job.status !== "completed") throw new Error("NOT_FOUND");
        if (job.rating) return reply({ rating: job.rating });
        await rpc("battle_rate", { p_key: "stylist:" + owner, p_max: 40 });
        const rating = await rateFit(
          key,
          await readInput(job.result_asset_id!, owner),
        );
        checked(
          await db.from("try_on_jobs").update({ rating }).eq("id", job.id),
        );
        return reply({ rating });
      }
      if (body.action === "label") {
        // Fills only what the person left blank; their own edits always win.
        await rpc("battle_rate", { p_key: "label:" + owner, p_max: 60 });
        const item = checked(
          await db
            .from("library_items")
            .select("id,category,color,brand,photo_path")
            .eq("id", String(body.id))
            .eq("owner_id", owner)
            .eq("kind", "wardrobe")
            .maybeSingle(),
        ) as {
          id: string;
          category: string;
          color: string;
          brand: string;
          photo_path: string | null;
        } | null;
        if (!item?.photo_path) throw new Error("NOT_FOUND");
        const file = await db.storage
          .from("library-private")
          .download(item.photo_path);
        if (file.error || !file.data || file.data.size > MAX_IMAGE_BYTES)
          throw new Error("NOT_FOUND");
        const bytes = new Uint8Array(await file.data.arrayBuffer());
        validateJpeg(bytes);
        const label = await labelGarment(
          key,
          "data:image/jpeg;base64," + toBase64(bytes),
        );
        const update = {
          ...(body.rename === true && label.name ? { name: label.name } : {}),
          ...(item.category === "Other" ? { category: label.category } : {}),
          ...(!item.color ? { color: label.color } : {}),
          ...(!item.brand ? { brand: label.brand } : {}),
        };
        if (Object.keys(update).length)
          checked(
            await db.from("library_items").update(update).eq("id", item.id),
          );
        return reply({ label });
      }
      const profile = checked(
        await db
          .from("profiles")
          .select("color_profile")
          .eq("id", owner)
          .single(),
      ) as { color_profile: { season?: string } | null };
      if (body.action === "colors") {
        if (profile.color_profile && body.refresh !== true)
          return reply({ colors: profile.color_profile });
        await rpc("battle_rate", { p_key: "stylist:" + owner, p_max: 40 });
        const saved = await db.storage
          .from("saved-photos")
          .download(owner + "/person.jpg");
        if (saved.error || !saved.data || saved.data.size > MAX_IMAGE_BYTES)
          throw new Error("NO_SAVED_PHOTO");
        const bytes = new Uint8Array(await saved.data.arrayBuffer());
        validateJpeg(bytes);
        const colors = await colorAnalysis(
          key,
          "data:image/jpeg;base64," + toBase64(bytes),
        );
        checked(
          await db
            .from("profiles")
            .update({ color_profile: colors })
            .eq("id", owner),
        );
        return reply({ colors });
      }
      const occasion =
        typeof body.occasion === "string" ? body.occasion.trim() : "";
      const styles = (Array.isArray(body.styles) ? body.styles : [])
        .filter((x): x is string => typeof x === "string" && x.length <= 24)
        .slice(0, 6);
      if (!occasion || occasion.length > 300)
        throw new Error("INVALID_REQUEST");
      // The written outfit is free; Pro just gets a higher limit.
      // ponytail: hourly limit via battle_rate; a daily cap needs its own counter.
      await rpc("battle_rate", {
        p_key: "outfit:" + owner,
        p_max: (await hasPro(owner)) ? 30 : 5,
      });
      let closet: ClosetItem[] | null = null;
      if (body.closet === true) {
        closet = required(
          await db
            .from("library_items")
            .select("id,name,category,color,brand,tags")
            .eq("owner_id", owner)
            .eq("kind", "wardrobe")
            .order("created_at", { ascending: false })
            .limit(150),
        );
        if (!closet.length) return reply({ outfit: null, emptyCloset: true });
      }
      return reply({
        outfit: await styleOutfit(key, occasion, styles, closet),
      });
    }
    if (body.action === "delete") {
      await removeJob(await ownedJob(body.id, owner));
      return reply({ deleted: true });
    }
    throw new Error("INVALID_REQUEST");
  } catch (error) {
    const code =
      error instanceof Error && exposed.has(error.message)
        ? error.message
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
