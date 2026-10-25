import React, { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { getSharedPayloads, clearSharedPayloads } from "expo-sharing";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Body,
  Button,
  ErrorState,
  FlatHeader,
  Heading,
  LoadingSkeleton,
  Page,
} from "../src/components/ui";
import {
  cleanSourceUrl,
  libraryItem,
  saveLibraryItem,
  type LibraryItem,
} from "../src/lib/library";
import { disposePhoto, pickPhoto, preparePhoto } from "../src/lib/photos";
import { useApp } from "../src/lib/state";
import { callTryOn } from "../src/lib/tryon-api";
import type { LocalPhoto } from "../src/types/tryon";
import { colors, fonts } from "../src/theme";

export default function LibraryEditor() {
  const params = useLocalSearchParams<{
    id?: string;
    kind?: string;
    shared?: string;
  }>();
  const { session } = useApp();
  const query = useQuery({
    queryKey: ["library-item", session?.user.id, params.id],
    queryFn: () => libraryItem(params.id!),
    enabled: !!session && !!params.id,
  });
  const [name, setName] = useState(""),
    [category, setCategory] = useState("Other"),
    [color, setColor] = useState(""),
    [brand, setBrand] = useState(""),
    [notes, setNotes] = useState(""),
    [tags, setTags] = useState(""),
    [url, setUrl] = useState("");
  const [photo, setPhoto] = useState<LocalPhoto | null>(null),
    [removePhoto, setRemovePhoto] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const initialized = useRef<string | null>(null),
    submitted = useRef(false);
  const kind: LibraryItem["kind"] =
    query.data?.kind ??
    (params.kind === "wardrobe" ? "wardrobe" : "inspiration");
  const client = useQueryClient();
  const previousOwner = useRef(session?.user.id);
  useEffect(() => {
    if (previousOwner.current && previousOwner.current !== session?.user.id) {
      initialized.current = null;
      setName("");
      setCategory("Other");
      setColor("");
      setBrand("");
      setNotes("");
      setTags("");
      setUrl("");
      setPhoto(null);
      setRemovePhoto(false);
      setError("");
    }
    previousOwner.current = session?.user.id;
  }, [session?.user.id]);
  useEffect(
    () => () => {
      void disposePhoto(photo);
    },
    [photo],
  );
  useEffect(() => {
    if (query.data && initialized.current !== query.data.id) {
      const item = query.data;
      initialized.current = item.id;
      setName(item.name);
      setCategory(item.category);
      setColor(item.color);
      setBrand(item.brand);
      setNotes(item.notes);
      setTags(item.tags);
      setUrl(item.source_url ?? "");
    }
  }, [query.data]);
  useEffect(() => {
    if (!params.shared || Platform.OS === "web") return;
    let active = true;
    let payloads: ReturnType<typeof getSharedPayloads>;
    try {
      payloads = getSharedPayloads();
    } catch {
      setError(
        "Receiving shares requires an Outfit League development build. You can still paste a link or choose a screenshot here.",
      );
      return;
    }
    const text =
      payloads.find((p) => p.shareType === "url" || p.shareType === "text")
        ?.value ?? "";
    const link = text.match(/https?:\/\/[^\s]+/i)?.[0];
    if (link) {
      try {
        setUrl(cleanSourceUrl(link) ?? "");
      } catch {
        setNotes(text.slice(0, 2000));
      }
    } else if (text) setNotes(text.slice(0, 2000));
    const image = payloads.find((p) => p.shareType === "image");
    if (image && /^(file|content):\/\//.test(image.value)) {
      setBusy(true);
      void preparePhoto(image.value)
        .then((p) => {
          if (active) setPhoto(p);
          else void disposePhoto(p);
        })
        .catch(() => {
          if (active)
            setError(
              "This shared image couldn’t load. Choose it from your gallery instead.",
            );
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    }
    if (payloads.length > 1)
      setError(
        "We imported the first image and link. Save additional images as separate items.",
      );
    return () => {
      active = false;
    };
  }, [params.shared]);
  async function choose(camera = false) {
    if (submitted.current) return;
    setError("");
    try {
      const picked = await pickPhoto(camera);
      if (picked) {
        setPhoto(picked);
        setRemovePhoto(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your photo couldn’t open.");
    }
  }
  async function save() {
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true);
    setError("");
    try {
      if (
        kind === "wardrobe" &&
        !photo &&
        (!query.data?.photo_path || removePhoto)
      )
        throw new Error("Add a photo of your clothing before saving.");
      if (
        kind === "inspiration" &&
        !query.data?.explore_image &&
        !photo &&
        (!query.data?.photo_path || removePhoto) &&
        !url.trim()
      )
        throw new Error(
          "Add a link, screenshot or image to save this inspiration.",
        );
      const id = await saveLibraryItem(
        kind,
        { name, category, color, brand, notes, tags, source_url: url },
        photo,
        query.data,
        removePhoto,
      );
      const refresh = async () => {
        await client.invalidateQueries({ queryKey: ["library"] });
        await client.invalidateQueries({
          queryKey: ["library-item", session?.user.id, id],
        });
      };
      await refresh();
      // AI fills name, category, colour and brand in the background.
      if (kind === "wardrobe" && photo)
        void callTryOn({ action: "label", id, rename: !name.trim() })
          .then(refresh)
          .catch(() => {});
      if (params.shared && Platform.OS !== "web") clearSharedPayloads();
      router.replace({ pathname: "/library-item/[id]", params: { id } });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Your item couldn’t save. Please try again.",
      );
    } finally {
      submitted.current = false;
      setBusy(false);
    }
  }
  const field = {
    minHeight: 54,
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
  };
  const imageUri = photo?.uri ?? (!removePhoto ? query.data?.photoUrl : null);
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Page keyboardInsets={false}>
        <FlatHeader
          title={
            params.id
              ? "Edit your item"
              : kind === "wardrobe"
                ? "Add clothing"
                : "Save inspiration"
          }
          pill="Private"
        />
        <View style={{ padding: 20, gap: 16 }}>
          {!session ? (
            <>
              <Heading>Keep your finds close.</Heading>
              <Body>
                Sign in to save this item privately. Shared content stays on
                this device until you save.
              </Body>
              <Button title="Sign in" onPress={() => router.push("/auth")} />
            </>
          ) : params.id && query.isPending ? (
            <LoadingSkeleton />
          ) : params.id && query.isError ? (
            <ErrorState
              message="This item couldn’t load."
              retry={() => void query.refetch()}
            />
          ) : (
            <>
              <Heading size={30}>
                {kind === "wardrobe"
                  ? "Your clothes. Your style."
                  : "Keep the inspiration."}
              </Heading>
              <Body>
                {kind === "wardrobe"
                  ? "Snap or pick one item. We’ll name and sort it for you."
                  : "Paste a link or add a screenshot. Social posts may not provide a preview; your source link is still saved."}
              </Body>
              {query.data?.explore_image && (
                <Body style={{ fontSize: 13 }}>
                  The original Explore sample stays with this item. You can add
                  your own garment photo; removing it restores the sample
                  illustration.
                </Body>
              )}
              {imageUri && (
                <Image
                  source={{ uri: imageUri }}
                  cachePolicy="none"
                  contentFit="contain"
                  style={{
                    height: 260,
                    backgroundColor: "#DCD5FF",
                    borderWidth: 4,
                    borderColor: colors.white,
                    borderRadius: 28,
                  }}
                />
              )}
              <View style={{ flexDirection: "row", gap: 10 }}>
                {Platform.OS !== "web" && (
                  <View style={{ flex: 1 }}>
                    <Button
                      secondary
                      icon="camera"
                      title="Take photo"
                      disabled={busy}
                      onPress={() => void choose(true)}
                    />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Button
                    secondary
                    icon="image"
                    title="Gallery"
                    disabled={busy}
                    onPress={() => void choose()}
                  />
                </View>
              </View>
              {!!imageUri && (
                <Button
                  secondary
                  title="Remove photo"
                  disabled={busy}
                  onPress={() => {
                    setPhoto(null);
                    setRemovePhoto(true);
                  }}
                />
              )}
              <Body>Name · optional</Body>
              <TextInput
                accessibilityLabel="Item name"
                value={name}
                onChangeText={setName}
                placeholder="e.g. My favorite denim jacket"
                placeholderTextColor={colors.placeholder}
                maxLength={100}
                editable={!busy}
                style={field}
              />
              {kind === "inspiration" && (
                <>
                  <Body>Link · optional with a photo</Body>
                  <TextInput
                    accessibilityLabel="Source link"
                    value={url}
                    onChangeText={setUrl}
                    placeholder="https://…"
                    placeholderTextColor={colors.placeholder}
                    autoCapitalize="none"
                    keyboardType="url"
                    maxLength={2048}
                    editable={!busy}
                    style={field}
                  />
                </>
              )}
              {!!error && (
                <Body
                  style={{
                    backgroundColor: colors.chip,
                    borderRadius: 18,
                    padding: 16,
                  }}
                >
                  {error}
                </Body>
              )}
              <Button
                title={busy ? "Saving…" : "Save privately"}
                disabled={busy}
                onPress={() => void save()}
              />
              <Button
                secondary
                title="Cancel"
                disabled={busy}
                onPress={() => {
                  if (params.shared && Platform.OS !== "web")
                    clearSharedPayloads();
                  router.canGoBack()
                    ? router.back()
                    : router.replace("/(tabs)/closet");
                }}
              />
            </>
          )}
        </View>
      </Page>
    </KeyboardAvoidingView>
  );
}
