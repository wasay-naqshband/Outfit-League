import { supabase } from "./supabase";
import { decode, encode } from "base64-arraybuffer";
import { randomUUID } from "expo-crypto";
import type { LocalPhoto } from "../types/tryon";

export const categories = [
  "Tops",
  "Shirts",
  "Hoodies",
  "Jackets",
  "Bottoms",
  "Dresses",
  "Shoes",
  "Accessories",
  "Other",
] as const;
export type LibraryItem = {
  id: string;
  owner_id: string;
  kind: "wardrobe" | "inspiration";
  name: string;
  category: string;
  color: string;
  brand: string;
  notes: string;
  tags: string;
  source_url: string | null;
  photo_path: string | null;
  created_at: string;
  updated_at: string;
  photoUrl?: string | null;
  explore_id?: string | null;
  explore_image?: keyof typeof import("../data").art | null;
  explore_garment?: keyof typeof import("./explore").garments | null;
  explore_photo_url?: string | null;
};
export type LibraryFields = Pick<
  LibraryItem,
  "name" | "category" | "color" | "brand" | "notes" | "tags" | "source_url"
>;
export { cleanSourceUrl } from "./source-url";
import { cleanSourceUrl } from "./source-url";
async function client() {
  if (!supabase) throw new Error("Please sign in to use your private Closet.");
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Please sign in to use your private Closet.");
  return { db: supabase, owner: data.user.id };
}
// The store search for a saved piece: its name, plus its colour when the
// name doesn't already say it.
export const shopQuery = (item: LibraryItem) =>
  item.color && !item.name.toLowerCase().includes(item.color.toLowerCase())
    ? `${item.color} ${item.name}`
    : item.name;
export async function libraryItem(id: string): Promise<LibraryItem> {
  const { db } = await client();
  const { data, error } = await db
    .from("library_items")
    .select("*")
    .eq("id", id)
    .single();
  if (error)
    throw new Error(
      "This item is unavailable. Refresh your Closet and try again.",
    );
  return withPhoto(data);
}
async function withPhoto(item: LibraryItem): Promise<LibraryItem> {
  if (!item.photo_path && item.explore_photo_url)
    return { ...item, photoUrl: `${item.explore_photo_url}?width=600` };
  if (!item.photo_path || !supabase) return item;
  const { data } = await supabase.storage
    .from("library-private")
    .createSignedUrl(item.photo_path, 300);
  return { ...item, photoUrl: data?.signedUrl ?? null };
}
export async function libraryPage(before?: string): Promise<LibraryItem[]> {
  const { db } = await client();
  let query = db
    .from("library_items")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(40);
  if (before) {
    const [created, id] = before.split("|");
    query = query.or(
      `created_at.lt.${created},and(created_at.eq.${created},id.lt.${id})`,
    );
  }
  const { data, error } = await query;
  if (error) throw new Error("Your Closet couldn’t load. Please try again.");
  return Promise.all(data.map(withPhoto));
}
export async function saveLibraryItem(
  kind: LibraryItem["kind"],
  fields: LibraryFields,
  photo: LocalPhoto | null,
  existing?: LibraryItem,
  removePhoto = false,
) {
  const { db, owner } = await client();
  const values = {
    ...fields,
    // No name? The AI labeler renames wardrobe items after their photo uploads.
    name:
      fields.name.trim() ||
      (kind === "wardrobe" ? "New item" : "Saved inspiration"),
    source_url: cleanSourceUrl(fields.source_url ?? ""),
  };
  const id = existing?.id ?? randomUUID();
  let newPath: string | null = null;
  let created = false;
  try {
    if (!existing) {
      const { error } = await db
        .from("library_items")
        .insert({ id, owner_id: owner, kind, ...values });
      if (error)
        throw new Error("Your item couldn’t be saved. Please try again.");
      created = true;
    }
    if (photo) {
      newPath = `${owner}/${id}/${randomUUID()}.jpg`;
      const { error } = await db.storage
        .from("library-private")
        .upload(newPath, decode(photo.base64), {
          contentType: "image/jpeg",
          cacheControl: "60",
          upsert: false,
        });
      if (error)
        throw new Error("Your photo couldn’t upload. Please try again.");
    }
    const { error } = await db
      .from("library_items")
      .update({
        ...values,
        // Metadata-only edits must preserve the server's current photo, even
        // when another device replaced it after this form was opened.
        ...(newPath
          ? { photo_path: newPath }
          : removePhoto
            ? { photo_path: null }
            : {}),
      })
      .eq("id", id)
      .select("id")
      .single();
    if (error)
      throw new Error("Your changes couldn’t be saved. Please try again.");
    return id;
  } catch (error) {
    // An uncertain update response may have committed. Keep possibly referenced
    // bytes; the worker removes unused uploads after their grace period.
    if (created) await db.from("library_items").delete().eq("id", id);
    throw error;
  }
}
export async function deleteLibraryItem(id: string) {
  const { db } = await client();
  const { error } = await db
    .from("library_items")
    .delete()
    .eq("id", id)
    .select("id")
    .single();
  if (error)
    throw new Error("Your item couldn’t be deleted. Please try again.");
}
export async function libraryGarment(item: LibraryItem): Promise<LocalPhoto> {
  const current = await libraryItem(item.id);
  if (!current.photo_path && current.explore_photo_url) {
    const { photoGarment } = await import("./explore");
    return photoGarment(current.explore_photo_url);
  }
  if (!current.photo_path && current.explore_garment) {
    const { sampleGarment } = await import("./explore");
    return sampleGarment(current.explore_garment);
  }
  if (!current.photo_path || !supabase)
    throw new Error("Add a clothing photo to this item first.");
  const { data, error } = await supabase.storage
    .from("library-private")
    .download(current.photo_path);
  if (error || !data || data.size > 8 * 1024 * 1024)
    throw new Error("Your photo couldn’t load. Please try again.");
  const buffer = await data.arrayBuffer();
  const base64 = encode(buffer);
  return {
    uri: "data:image/jpeg;base64," + base64,
    base64,
    bytes: buffer.byteLength,
    width: 0,
    height: 0,
  };
}
