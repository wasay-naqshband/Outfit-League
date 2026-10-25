import { supabase } from "./supabase";
import { analytics } from "./analytics";
import { exploreItem } from "./explore";
import { libraryItem } from "./library";
import {
  MetadataGarmentIdentifier,
  type IdentificationSource,
} from "./shopping-domain";
import { randomUUID } from "expo-crypto";
import type { Palette } from "../theme";
import type { garments } from "./explore";
import ecosusiTestSnapshot from "../awin-ecosusi-test.json";
export type Product = {
  id: string;
  retailer_id: string;
  retailer_name?: string;
  name: string;
  category: string;
  color: string;
  brand: string;
  tags: string;
  image_key: keyof typeof garments | null;
  palette: Palette;
  price_minor: number;
  currency: string;
  product_url: string | null;
  is_demo: boolean;
  availability: "unknown" | "in_stock" | "out_of_stock";
  price_checked_at: string | null;
  image_url: string | null;
  expires_at: string | null;
  is_test_preview?: boolean;
  feed_updated_at?: string;
};
export type CatalogSearch = {
  category: string;
  search: string;
  currency: string;
  maxMinor?: number | null;
  exactExplore?: string | null;
  live?: boolean;
};
export interface CatalogAdapter {
  page(
    search: CatalogSearch,
    cursor?: { price: number; id: string },
  ): Promise<Product[]>;
}
export class SupabaseCatalog implements CatalogAdapter {
  async page(
    search: CatalogSearch,
    cursor?: { price: number; id: string },
  ): Promise<Product[]> {
    if (!supabase) throw new Error("The catalog needs a connection.");
    const { data, error } = await supabase.rpc("catalog_page", {
      p_category: search.category,
      p_search: search.search,
      p_currency: search.currency,
      p_max_minor: search.maxMinor ?? null,
      p_exact_explore: search.exactExplore ?? null,
      p_after_price: cursor?.price ?? -1,
      p_after_id: cursor?.id ?? "",
      p_limit: 20,
      p_live: search.live ?? false,
    });
    if (error) throw new Error("The catalog couldn’t load. Please try again.");
    const products = data as Product[];
    if (!products.length) return products;
    const retailers = await supabase
      .from("catalog_retailers")
      .select("id,name")
      .in("id", [...new Set(products.map((item) => item.retailer_id))]);
    if (retailers.error)
      throw new Error("Retailer details couldn’t load. Please try again.");
    const names = new Map(retailers.data.map((item) => [item.id, item.name]));
    return products.map((item) => ({
      ...item,
      retailer_name: names.get(item.retailer_id),
    }));
  }
}
export const catalog = new SupabaseCatalog();
class EcosusiTestCatalog implements CatalogAdapter {
  async page(
    search: CatalogSearch,
    cursor?: { price: number; id: string },
  ): Promise<Product[]> {
    if (search.exactExplore) return [];
    return (ecosusiTestSnapshot as Product[])
      .filter(
        (item) =>
          item.currency === search.currency &&
          (search.category === "" || item.category === search.category) &&
          (!search.search ||
            `${item.name} ${item.brand} ${item.color} ${item.tags}`
              .toLowerCase()
              .includes(search.search.toLowerCase())) &&
          (search.maxMinor == null || item.price_minor < search.maxMinor),
      )
      .sort((a, b) => a.price_minor - b.price_minor || a.id.localeCompare(b.id))
      .filter(
        (item) =>
          !cursor ||
          item.price_minor > cursor.price ||
          (item.price_minor === cursor.price && item.id > cursor.id),
      )
      .slice(0, 20);
  }
}
export const ecosusiTestCatalog = new EcosusiTestCatalog();
export async function shoppingSource(params: {
  look?: string;
  library?: string;
  job?: string;
}) {
  let source: IdentificationSource = {};
  let name = "Your search",
    exploreId: string | null = null;
  if (params.library) {
    const item = await libraryItem(params.library);
    source = {
      ...item,
      color: item.color || (!item.photo_path ? (item.explore_image ?? "") : ""),
    };
    name = item.name;
    // A replaced personal photo is not evidence for the original catalog outfit.
    exploreId = item.photo_path ? null : (item.explore_id ?? null);
    analytics.track("shop_saved_look_opened", { source: "library" });
  } else if (params.look) {
    const item = await exploreItem(params.look);
    // The seed's asset key is provided sample-color metadata, not image analysis.
    source = { ...item, color: item.image };
    name = item.name;
    exploreId = item.id;
  } else if (params.job) {
    if (!supabase) throw new Error("Please sign in.");
    const { data, error } = await supabase
      .from("try_on_jobs")
      .select("id,status")
      .eq("id", params.job)
      .single();
    if (error || data?.status !== "completed")
      throw new Error("This completed look is unavailable.");
    name = "Your AI preview";
    analytics.track("shop_saved_look_opened", { source: "ai" });
  }
  const hints = await new MetadataGarmentIdentifier().identify(source);
  return { name, exploreId, hints };
}
export async function retailerDestination(product: string) {
  if (!supabase) throw new Error("The retailer connection is unavailable.");
  const { data, error } = await supabase.functions.invoke("shopping", {
    body: { action: "outbound", product, requestId: randomUUID() },
  });
  if (error || data?.error)
    throw new Error(
      "This retailer link is not available. No purchase was made.",
    );
  return data as { url: string; affiliate: boolean; retailer: string };
}
