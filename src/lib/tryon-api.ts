import { supabase } from "./supabase";
import { decode } from "base64-arraybuffer";
import { analytics } from "./analytics";
import { Platform } from "react-native";
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
  const ticket = await callTryOn<{ id: string; path: string; token: string }>({
    action: "upload",
    kind,
    size: photo.bytes,
  });
  const { error } = await supabase.storage
    .from("tryon-private")
    .uploadToSignedUrl(ticket.path, ticket.token, decode(photo.base64), {
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
  const { data, error } = await supabase
    .from("credit_wallets")
    .select("available,reserved")
    .single();
  if (error) throw error;
  return data;
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
export async function imageFromLink(url: string): Promise<LocalPhoto> {
  const photo = await callTryOn<{ type: string; data: string }>({
    action: "link",
    url,
  });
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
export type Swatch = { name: string; hex: string };
export type ColorProfile = {
  season: string;
  summary: string;
  best: Swatch[];
  neutrals: Swatch[];
  avoid: Swatch[];
  tips: string[];
};
export type OutfitPick = {
  title: string;
  why: string;
  items: string[];
  missing: string[];
  tips: string[];
};
export const rateLook = (id: string) =>
  callTryOn<{ rating: Rating }>({ action: "rate", id });
export const colorProfile = (refresh = false) =>
  callTryOn<{ colors: ColorProfile }>({ action: "colors", refresh });
export const pickOutfit = (occasion: string) =>
  callTryOn<{ outfit: OutfitPick }>({ action: "outfit", occasion });
