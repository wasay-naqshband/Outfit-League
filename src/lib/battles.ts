import { supabase } from "./supabase";
import { Linking, Platform, Share } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Clipboard from "expo-clipboard";
import { randomUUID } from "expo-crypto";
import type { art } from "../data";
export type Side = "A" | "B" | "C" | "D";
export type Player = { name: string | null; avatar: string | null } | null;
export type BattleView = {
  id: string;
  title: string;
  mode: "anonymous" | "public";
  kind: "choose" | "versus";
  status:
    "draft" | "waiting" | "published" | "closed" | "unpublished" | "hidden";
  ready: boolean;
  isOwner: boolean;
  isFriend: boolean;
  options: {
    side: Side;
    url: string | null;
    sample: keyof typeof art | null;
    label: string;
  }[];
  players: { a: Player; b: Player } | null;
  counts: Record<Side, number>;
  mine: Side | null;
  voters: { id: number; choice: Side; display_name: string }[];
  comments: {
    id: number;
    name: string;
    body: string;
    at: string;
    mine: boolean;
  }[];
};
export type BattleRow = {
  id: string;
  title: string;
  kind: BattleView["kind"];
  voting_mode: BattleView["mode"];
  status: BattleView["status"];
  created_at: string;
};
let tokenPromise: Promise<string> | null = null;
async function browserToken() {
  if (!tokenPromise)
    tokenPromise = (async () => {
      const key = "outfit-league-battle-browser";
      try {
        const prior =
          Platform.OS === "web"
            ? localStorage.getItem(key)
            : await SecureStore.getItemAsync(key);
        if (prior && /^[0-9a-f-]{36}$/i.test(prior)) return prior;
        const token = randomUUID();
        if (Platform.OS === "web") localStorage.setItem(key, token);
        else await SecureStore.setItemAsync(key, token);
        return token;
      } catch {
        return randomUUID();
      }
    })();
  return tokenPromise;
}
const messages: Record<string, string> = {
  UNAUTHORIZED: "Please sign in to continue.",
  NOT_FOUND: "This battle is unavailable or no longer shared.",
  INVALID_REQUEST: "Something was off with that request. Please try again.",
  INVALID_SOURCE:
    "Choose two different available images from your own Closet or completed AI looks.",
  RATE_LIMIT: "Too many requests. Please try again later.",
  COMMENT_NOT_ALLOWED:
    "That comment breaks our community rules. Keep it kind and try again.",
  PUBLIC_IDENTITY_REQUIRED:
    "Sign in, enter a display name and agree to show your name and vote.",
  VOTING_CLOSED: "Voting is closed for this battle.",
  INVALID_STATE:
    "This battle has changed or someone already joined. Refresh to see it.",
  PUBLISH_CONSENT_REQUIRED:
    "Confirm that these two images can be shared publicly.",
};
export async function battleCall<T = BattleView>(
  body: Record<string, unknown>,
): Promise<T> {
  if (!supabase)
    throw new Error("Battles need a connection. Please try again.");
  const { data, error } = await supabase.functions.invoke("battles", {
    body: { ...body, token: await browserToken() },
  });
  if (error) {
    const response =
      "context" in error && error.context instanceof Response
        ? await error.context.json().catch(() => null)
        : null;
    throw new Error(
      messages[response?.error] ??
        "This battle request couldn’t finish. Please try again.",
    );
  }
  if (data?.error) throw new Error(messages[data.error] ?? "Please try again.");
  return data;
}
export async function myBattles(before?: string): Promise<BattleRow[]> {
  if (!supabase) throw new Error("Please sign in.");
  let query = supabase
    .from("battles")
    .select("id,title,kind,voting_mode,status,created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(20);
  if (before) {
    const [created, id] = before.split("|");
    query = query.or(
      `created_at.lt.${created},and(created_at.eq.${created},id.lt.${id})`,
    );
  }
  const { data, error } = await query;
  if (error) throw new Error("Your battles couldn’t load.");
  return data;
}
export function publicBattleUrl(id: string) {
  const configured = (process.env.EXPO_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return null;
    return `${url.origin}/battle/${id}`;
  } catch {
    return null;
  }
}
export async function copyBattleLink(id: string) {
  const url = publicBattleUrl(id);
  if (!url)
    throw new Error(
      "A public app address is needed before friends can open this link.",
    );
  if (Platform.OS === "web") {
    if (!navigator.clipboard)
      throw new Error("Select and copy the voting link shown below.");
    try {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          navigator.clipboard.writeText(url),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error("Clipboard unavailable")),
              2000,
            );
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    } catch {
      throw new Error(
        "This browser blocked copying. Select and copy the voting link shown below.",
      );
    }
  } else if (!(await Clipboard.setStringAsync(url)))
    throw new Error("Select and copy the voting link shown below.");
}
export async function shareBattleLink(
  id: string,
  title: string,
  text = `${title} — vote for your pick!`,
) {
  const url = publicBattleUrl(id);
  if (!url)
    throw new Error(
      "A public app address is needed before friends can open this link.",
    );
  if (Platform.OS === "web") {
    if (navigator.share)
      await navigator.share({
        title: "Outfit League",
        text,
        url,
      });
    else await copyBattleLink(id);
  } else
    await Share.share({ title: "Outfit League", message: `${text} ${url}` });
}
export async function rememberBattleReturn(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  try {
    if (Platform.OS === "web") sessionStorage.setItem("battle-return", id);
    else await SecureStore.setItemAsync("battle-return", id);
  } catch {}
}
export async function takeBattleReturn() {
  try {
    const id =
      Platform.OS === "web"
        ? sessionStorage.getItem("battle-return")
        : await SecureStore.getItemAsync("battle-return");
    if (Platform.OS === "web") sessionStorage.removeItem("battle-return");
    else await SecureStore.deleteItemAsync("battle-return");
    return id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
  } catch {
    return null;
  }
}

// Completed try-ons with a short-lived thumbnail, for picking battle looks.
export async function myLooks(): Promise<{ id: string; url: string }[]> {
  if (!supabase) return [];
  const jobs = await supabase
    .from("try_on_jobs")
    .select("id,result_asset_id")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(30);
  if (jobs.error) throw new Error("Your looks couldn’t load.");
  const assets = await supabase
    .from("private_assets")
    .select("id,path")
    .in(
      "id",
      jobs.data.map((job) => job.result_asset_id),
    );
  if (assets.error) throw new Error("Your looks couldn’t load.");
  const paths = new Map(assets.data.map((x) => [x.id, x.path as string]));
  const rows = jobs.data.flatMap((job) => {
    const path = paths.get(job.result_asset_id);
    return path ? [{ id: job.id as string, path }] : [];
  });
  if (!rows.length) return [];
  const signed = await supabase.storage.from("tryon-private").createSignedUrls(
    rows.map((row) => row.path),
    600,
  );
  if (signed.error) throw new Error("Your looks couldn’t load.");
  return rows.flatMap((row, i) => {
    const url = signed.data[i]?.signedUrl;
    return url ? [{ id: row.id, url }] : [];
  });
}

export async function whatsappBattleLink(id: string, text: string) {
  const url = publicBattleUrl(id);
  if (!url) throw new Error("A public app address is needed first.");
  await Linking.openURL(
    "https://wa.me/?text=" + encodeURIComponent(`${text} ${url}`),
  );
}
