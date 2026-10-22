import { decode, encode } from "base64-arraybuffer";
import { supabase } from "./supabase";
import type { LocalPhoto } from "../types/tryon";

// The person's reusable try-on photo, kept privately in their account.
const bucket = () => supabase!.storage.from("saved-photos");
const path = (owner: string) => `${owner}/person.jpg`;

export async function loadSavedPhoto(
  owner: string,
): Promise<LocalPhoto | null> {
  const { data, error } = await bucket().download(path(owner));
  // Not found is the normal "no saved photo yet" state.
  if (error || !data) return null;
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

export async function saveSavedPhoto(owner: string, photo: LocalPhoto) {
  const { error } = await bucket().upload(path(owner), decode(photo.base64), {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) throw new Error("Your photo couldn’t be saved. Please retry.");
}

export async function removeSavedPhoto(owner: string) {
  const { error } = await bucket().remove([path(owner)]);
  if (error) throw new Error("Your photo couldn’t be removed. Please retry.");
}
