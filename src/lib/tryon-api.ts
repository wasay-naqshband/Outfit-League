import { supabase } from "./supabase";
import { decode } from "base64-arraybuffer";
import { analytics } from "./analytics";
import { Platform } from "react-native";
import * as Application from "expo-application";
import { randomUUID } from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import { preparePhoto } from "./photos";
import type {
  JobView,
  LocalPhoto,
  TryOnConfig,
  TryOnJob,
  Wallet,
} from "../types/tryon";

export async function callTryOn<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error("PROVIDER_NOT_CONFIGURED");
  const { data, error } = await supabase.functions.invoke("tryon", { body });
  if (error) {
    if ("context" in error && error.context instanceof Response) {
      const response = await error.context.json().catch(() => null);
      if (response?.error) throw new Error(response.error);
    }
    throw new Error("REQUEST_FAILED");
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}
export async function uploadPhoto(
  photo: LocalPhoto,
  kind: "person" | "garment",
) {
  if (!supabase) throw new Error("UNAUTHORIZED");
  const image = photo.base64
    ? decode(photo.base64)
    : await fetch(photo.uri).then((response) => {
        if (!response.ok) throw new Error("PHOTO_UNAVAILABLE");
        return response.arrayBuffer();
      });
  const ticket = await callTryOn<{ id: string; path: string; token: string }>({
    action: "upload",
    kind,
    size: image.byteLength,
  });
  const { error } = await supabase.storage
    .from("tryon-private")
    .uploadToSignedUrl(ticket.path, ticket.token, image, {
      contentType: "image/jpeg",
      upsert: false,
    });
  if (error) {
    await callTryOn({ action: "remove-upload", id: ticket.id }).catch(() => {});
    throw new Error("UPLOAD_FAILED");
  }
  return ticket.id;
}
export const fetchConfig = () => callTryOn<TryOnConfig>({ action: "config" });
export async function fetchJob(id: string) {
  const view = await callTryOn<JobView>({ action: "status", id });
  if (view.job.status === "completed" || view.job.status === "failed")
    analytics.track(
      view.job.status === "completed" ? "try_on_completed" : "try_on_failed",
      { mode: "live" },
      `terminal:${id}`,
    );
  return view;
}
export const startSpin = (id: string) =>
  callTryOn<JobView>({ action: "spin", id });
export async function fetchWallet(): Promise<Wallet> {
  if (!supabase) throw new Error("UNAUTHORIZED");
  const { data, error } = await supabase.rpc("read_my_wallet");
  if (error) throw error;
  return data as Wallet;
}
export async function fetchHistory(): Promise<TryOnJob[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("try_on_jobs")
    .select(
      "id,owner_id,status,error_code,created_at,expires_at,person_asset_id,garment_asset_id,result_asset_id",
    )
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}
export async function saveLook(id: string, saved: boolean) {
  if (!supabase) throw new Error("UNAUTHORIZED");
  const { data, error } = await supabase
    .from("looks")
    .update({ saved })
    .eq("id", id)
    .select("id")
    .single();
  if (error || !data) throw new Error("SAVE_FAILED");
  if (saved) analytics.track("look_saved", { source: "ai" }, `look:${id}`);
}
// Product photo from a store link (Zara, H&M, Shein…), as a private JPEG.
export const imageFromLink = (url: string) =>
  photoFromServer({ action: "link", url });
// The store's own product page for a lookalike (not Google's).
export const lookalikeLink = (id: string, index: number) =>
  callTryOn<{ url: string }>({ action: "lookalike-link", id, index });
export type Lookalike = {
  title: string;
  store: string;
  /** null when only the store page shows the price */
  price: number | null;
  url: string;
  image: string;
  score?: number;
};
export const fetchLookalikes = (id: string) =>
  callTryOn<{ items: Lookalike[]; locked: number }>({
    action: "lookalikes",
    id,
  });
async function photoFromServer(
  body: Record<string, unknown>,
): Promise<LocalPhoto> {
  const photo = await callTryOn<{ type: string; data: string }>(body);
  if (Platform.OS === "web")
    return preparePhoto(`data:${photo.type};base64,${photo.data}`);
  const file = `${FileSystem.cacheDirectory}link-${randomUUID()}`;
  await FileSystem.writeAsStringAsync(file, photo.data, {
    encoding: FileSystem.EncodingType.Base64,
  });
  try {
    return await preparePhoto(file);
  } finally {
    await FileSystem.deleteAsync(file, { idempotent: true }).catch(() => {});
  }
}
export type Rating = {
  score: number;
  headline: string;
  good: string[];
  tips: string[];
};
export type OutfitPiece = {
  part: "top" | "layer" | "bottoms" | "shoes" | "accessory";
  name: string;
  query: string;
  /** Set when the piece is already in their closet. */
  closetId: string | null;
};
export type OutfitPick = {
  title: string;
  why: string;
  pieces: OutfitPiece[];
  tips: string[];
};
export const rateLook = (id: string) =>
  callTryOn<{ rating: Rating }>({ action: "rate", id });
export const pickOutfit = (
  occasion: string,
  styles: string[],
  closet = false,
  person?: string,
  anchor?: string,
) =>
  callTryOn<{ outfit: OutfitPick | null; emptyCloset?: boolean }>({
    action: "outfit",
    occasion,
    styles,
    closet,
    person,
    anchor,
  });
// Shop tab: rails of real products for their department and style.
export type ShopRail = { id: string; title: string; items: Lookalike[] };
export const shopFeed = (styles: string[]) =>
  callTryOn<{ rails: ShopRail[] }>({ action: "shop-feed", styles });
// Shop the look: real products for one piece, and the store's own page.
export const shopPiece = (query: string) =>
  callTryOn<{ items: Lookalike[] }>({ action: "shop-piece", query });
// Store pages open straight away; only Google Shopping links need resolving.
export const pieceLink = async (item: Lookalike) =>
  !/(^|\.)google\./.test(new URL(item.url).hostname)
    ? { url: item.url }
    : callTryOn<{ url: string }>({ action: "piece-link", item });
export type Scan = {
  name: string;
  category: string;
  colors: { name: string; hex: string }[];
  details: {
    type: "fabric" | "fit" | "collar" | "graphic" | "other";
    label: string;
    value: string;
  }[];
  vibe: string;
  vibeLine: string;
  price: string;
  query: string;
  /** 1–10: how well it suits them (colour season + style) */
  score: number;
  verdict: string;
  /** Closet pieces it goes with */
  pairs: { id: string; name: string }[];
  idea: string;
  verdicts?: {
    style: { value: string; status: "good" | "mixed" | "poor"; label: string };
    colour: { value: string; status: "good" | "mixed" | "poor"; label: string };
  };
  annotations?: { label: string; point?: { x: number; y: number } }[];
  pairing?: { name: string; hex: string };
  priceRange?: { low: number; high: number; currency: "USD" };
};
// This phone's app ID, so the free daily scan cap counts per phone as well as
// per account. ponytail: resets on reinstall and can be faked; Apple
// DeviceCheck if people get around it.
async function deviceId() {
  try {
    if (Platform.OS === "ios")
      return await Application.getIosIdForVendorAsync();
    if (Platform.OS === "android") return Application.getAndroidId();
  } catch {
    /* no id: the account cap still applies */
  }
  return null;
}
// Scan tab: the photo is uploaded privately, read, then removed.
export async function scanPhoto(photo: LocalPhoto, styles: string[]) {
  const id = await uploadPhoto(photo, "garment");
  try {
    const result = await callTryOn<{ scan: Scan; items: Lookalike[] }>({
      action: "scan",
      id,
      styles,
      device: await deviceId(),
    });
    // Older deployed scan functions return plain strings until their update lands.
    const details = (
      Array.isArray(result.scan.details)
        ? (result.scan.details as unknown[])
        : []
    ).flatMap((detail) => {
      if (typeof detail === "string")
        return [{ type: "other" as const, label: "Detail", value: detail }];
      if (!detail || typeof detail !== "object") return [];
      const item = detail as Partial<Scan["details"][number]>;
      return typeof item.value === "string"
        ? [
            {
              type: item.type ?? "other",
              label: item.label || "Detail",
              value: item.value,
            },
          ]
        : [];
    });
    return { ...result, scan: { ...result.scan, details } };
  } finally {
    void callTryOn({ action: "remove-upload", id }).catch(() => {});
  }
}
