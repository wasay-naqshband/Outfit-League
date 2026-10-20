import { supabase } from "./supabase";
import type { Outfit, art } from "../data";
import { Image, Platform } from "react-native";
import { preparePhoto } from "./photos";
import { analytics } from "./analytics";

export const garments = {
  navy: require("../../assets/garments/navy.jpg"),
  cream: require("../../assets/garments/cream.jpg"),
  rust: require("../../assets/garments/rust.jpg"),
  green: require("../../assets/garments/green.jpg"),
  ivory: require("../../assets/garments/ivory.jpg"),
};
export type ExploreOutfit = {
  id: string;
  name: string;
  style: string;
  category: string;
  description: string;
  brand: string;
  tags: string;
  image: keyof typeof art;
  garment: keyof typeof garments | null;
  palette: Outfit["palette"];
  source_label: string;
  source_url: string | null;
  rank: number;
};
export function cardOutfit(item: ExploreOutfit): Outfit {
  return { ...item, category: item.style, source: "Sample collection" };
}
export async function explorePage(
  search: string,
  style: string,
  after = -1,
): Promise<ExploreOutfit[]> {
  if (!supabase)
    throw new Error("Explore needs a connection. Please try again.");
  const { data, error } = await supabase.rpc("explore_page", {
    search_text: search.trim().slice(0, 100),
    style_filter: style === "Trending" ? "" : style,
    after_rank: after,
    page_size: 12,
  });
  if (error) throw new Error("Explore couldn’t load. Please try again.");
  return data;
}
export async function exploreItem(id: string): Promise<ExploreOutfit> {
  if (!supabase) throw new Error("Explore is unavailable.");
  const { data, error } = await supabase
    .from("explore_outfits")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error("This outfit is unavailable.");
  return data;
}
export async function exploreSaveState(id: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("library_items")
    .select("id")
    .eq("explore_id", id)
    .maybeSingle();
  if (error) throw new Error("Your saved status couldn’t load.");
  return data?.id ?? null;
}
export async function saveExplore(id: string): Promise<string> {
  if (!supabase) throw new Error("Please sign in to save this outfit.");
  const { data, error } = await supabase.rpc("save_explore", { outfit_id: id });
  if (error)
    throw new Error("This outfit couldn’t be saved. Please try again.");
  analytics.track(
    "inspiration_saved",
    { source: "explore" },
    `inspiration:${data}`,
  );
  return data;
}
export async function sampleGarment(key: keyof typeof garments) {
  if (!(key in garments)) throw new Error("This garment is unavailable.");
  // React Native Web exports image URLs, while native bundles use asset IDs.
  const source = garments[key];
  const asset =
    Platform.OS === "web"
      ? {
          uri: typeof source === "string" ? source : source.uri,
          width: 800,
          height: 800,
        }
      : Image.resolveAssetSource(source);
  return preparePhoto(asset.uri, asset.width, asset.height);
}
