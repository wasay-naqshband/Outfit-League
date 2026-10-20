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
import { FashnProvider, GenlookProvider } from "../_shared/provider.ts";
import { normalizeResult } from "../_shared/result-image.ts";
import { cleanupAccounts } from "../_shared/account-cleanup.ts";

const env = (name: string) => Deno.env.get(name) ?? "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const bucket = db.storage.from("tryon-private");
const providerName = env("TRYON_PROVIDER") === "genlook" ? "Genlook" : "FASHN";
const providers = {
  Genlook: new GenlookProvider(env("GENLOOK_API_KEY"), fetch, normalizeResult),
  FASHN: new FashnProvider(env("FASHN_API_KEY")),
};
const provider = providers[providerName];
const providerKey = (name: string) =>
  env(name === "Genlook" ? "GENLOOK_API_KEY" : "FASHN_API_KEY");
const enabled = () =>
  env("LIVE_TRYON_ENABLED") === "true" && !!providerKey(providerName);
type Job = {
  id: string;
  owner_id: string;
  person_asset_id: string;
  garment_asset_id: string;
  result_asset_id: string | null;
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
async function submitJob(job: Job) {
  if (!enabled()) return; // Remains pending; worker resumes when explicitly enabled.
  const claimed = await rpc("claim_tryon", { p_job: job.id });
  if (!claimed) return;
  try {
    const [person, garment] = await Promise.all([
      readInput(job.person_asset_id, job.owner_id),
      readInput(job.garment_asset_id, job.owner_id),
    ]);
    const prediction = await provider.submit(person, garment);
    await rpc("attach_prediction", {
      p_job: job.id,
      p_prediction:
        providerName === "Genlook" ? "genlook:" + prediction : prediction,
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
  if (!job.provider_id) return;
  const jobProvider = job.provider_id.startsWith("genlook:")
    ? "Genlook"
    : "FASHN";
  if (!providerKey(jobProvider)) return;
  let prediction;
  try {
    prediction = await providers[jobProvider].status(
      jobProvider === "Genlook" ? job.provider_id.slice(8) : job.provider_id,
    );
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
      const bytes = decodeResult(prediction.image);
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
  const ids = [job.person_asset_id, job.result_asset_id].filter(Boolean);
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
  return {
    job,
    beforeUrl: signed.person ?? null,
    afterUrl: signed.result ?? null,
    look,
  };
}
async function removeJob(job: Job) {
  if (!terminal(job.status)) throw new Error("ACTIVE_JOB");
  const ids = [
    job.person_asset_id,
    job.garment_asset_id,
    job.result_asset_id,
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
                asset.id,
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
        provider: providerName,
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
              asset.id,
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
      if (
        !uuid(body.key) ||
        !uuid(body.person) ||
        !uuid(body.garment) ||
        body.consent !== CONSENT_VERSION
      )
        throw new Error("INVALID_REQUEST");
      const reserved = await rpc("reserve_tryon", {
        p_owner: owner,
        p_key: body.key,
        p_person: body.person,
        p_garment: body.garment,
        p_consent: body.consent,
      });
      if (reserved.created) await submitJob(reserved.job);
      return reply(await resultView(await ownedJob(reserved.job.id, owner)));
    }
    if (body.action === "status") {
      const job = await ownedJob(body.id, owner);
      await syncJob(job);
      return reply(await resultView(await ownedJob(job.id, owner)));
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
