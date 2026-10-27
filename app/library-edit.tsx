import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { getSharedPayloads, clearSharedPayloads } from "expo-sharing";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Body,
  Button,
  ErrorState,
  Heading,
  Icon,
  LoadingSkeleton,
  Page,
  RoundButton,
  StickerBadge,
} from "../src/components/ui";
import {
  AddItemDropZone,
  AutoFillChips,
  type AutoFill,
} from "../src/components/AddClothing";
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
import { colors, fonts, gradients, shadow } from "../src/theme";

type Label = { name: string; category: string; color: string; style: string };

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
    [reading, setReading] = useState(false),
    [filled, setFilled] = useState<AutoFill | null>(null),
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
        setFilled(null);
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
      // AI fills name, category, colour and style; show it before leaving.
      if (kind === "wardrobe" && photo) {
        setReading(true);
        const call = callTryOn<{ label: Label }>({
          action: "label",
          id,
          rename: !name.trim(),
        });
        // Refresh whenever it lands, even after we've moved on.
        void call.then(refresh, () => {});
        try {
          const { label } = await Promise.race([
            call,
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("slow")), 15000),
            ),
          ]);
          setFilled({
            category: label.category,
            colour: label.color,
            style: label.style,
            name: name.trim() || label.name,
          });
          await new Promise((resolve) => setTimeout(resolve, 1100));
        } catch {
          // Slow or failed labelling never blocks the save.
        } finally {
          setReading(false);
        }
      }
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
    paddingHorizontal: 16,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
    ...shadow(0.06),
  };
  const imageUri = photo?.uri ?? (!removePhoto ? query.data?.photoUrl : null);
  const wardrobe = kind === "wardrobe";
  const item = query.data;
  // Existing values count as filled; a fresh AI label replaces them.
  const chips: AutoFill = filled ?? {
    category: item && item.category !== "Other" ? item.category : undefined,
    colour: item?.color || undefined,
    style: item?.tags || undefined,
    name: item?.name || undefined,
  };
  const working = busy || reading;
  const needsPhoto = wardrobe && !imageUri;
  const cancel = () => {
    if (params.shared && Platform.OS !== "web") clearSharedPayloads();
    router.canGoBack() ? router.back() : router.replace("/(tabs)/closet");
  };
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Page keyboardInsets={false}>
        <LinearGradient
          colors={gradients.yellow}
          style={{
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
            paddingTop: 28,
            paddingHorizontal: 20,
            paddingBottom: 22,
            gap: 14,
            ...shadow(0.1),
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <RoundButton name="arrow-left" label="Back" onPress={cancel} />
            <Heading size={28} style={{ flex: 1, letterSpacing: -0.9 }}>
              {params.id
                ? "Edit your item"
                : wardrobe
                  ? "Add clothing"
                  : "Save inspiration"}
            </Heading>
            <View
              accessible
              accessibilityLabel="Saved privately to your closet"
              style={{
                height: 40,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 13,
                borderRadius: 999,
                backgroundColor: colors.ink,
              }}
            >
              <Icon name="lock" size={14} color={colors.yellow} />
              <Text
                style={{
                  fontFamily: fonts.bold,
                  fontSize: 13,
                  color: colors.white,
                }}
              >
                Private
              </Text>
            </View>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <Heading size={30} style={{ letterSpacing: -1 }}>
              {wardrobe ? "Your clothes." : "Keep the"}
            </Heading>
            <StickerBadge size={24} rotate="-5deg">
              {wardrobe ? "Your style." : "inspiration."}
            </StickerBadge>
          </View>
        </LinearGradient>
        <View style={{ padding: 20, paddingTop: 18, gap: 18 }}>
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
              <AddItemDropZone
                imageUri={imageUri}
                reading={reading}
                disabled={working}
                helper={
                  wardrobe
                    ? "Snap or pick it. We’ll name and sort it."
                    : "Add a screenshot, or paste the link below."
                }
                onCamera={() => void choose(true)}
                onGallery={() => void choose()}
              />
              {!!imageUri && !working && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setPhoto(null);
                    setRemovePhoto(true);
                    setFilled(null);
                  }}
                  style={{
                    alignSelf: "center",
                    minHeight: 44,
                    justifyContent: "center",
                    marginVertical: -10,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.bold,
                      fontSize: 14,
                      color: colors.text2,
                      textDecorationLine: "underline",
                    }}
                  >
                    Remove photo
                  </Text>
                </Pressable>
              )}
              {item?.explore_image && (
                <Body style={{ fontSize: 13 }}>
                  The original Explore sample stays with this item. Removing
                  your photo restores the sample illustration.
                </Body>
              )}
              {wardrobe && <AutoFillChips values={chips} />}
              <View style={{ gap: 8 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14 }}>
                  Name it{" "}
                  <Text
                    style={{ fontFamily: fonts.medium, color: colors.text3 }}
                  >
                    (optional)
                  </Text>
                </Text>
                <View style={{ justifyContent: "center" }}>
                  <TextInput
                    accessibilityLabel="Item name"
                    value={name}
                    onChangeText={setName}
                    placeholder={
                      filled?.name || "e.g. My favourite denim jacket"
                    }
                    placeholderTextColor={colors.placeholder}
                    maxLength={100}
                    editable={!working}
                    style={[field, { paddingLeft: 46 }]}
                  />
                  <View
                    pointerEvents="none"
                    style={{ position: "absolute", left: 16 }}
                  >
                    <Icon name="tag" size={18} color={colors.text3} />
                  </View>
                </View>
              </View>
              {!wardrobe && (
                <View style={{ gap: 8 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14 }}>
                    Link{" "}
                    <Text
                      style={{ fontFamily: fonts.medium, color: colors.text3 }}
                    >
                      (optional with a photo)
                    </Text>
                  </Text>
                  <TextInput
                    accessibilityLabel="Source link"
                    value={url}
                    onChangeText={setUrl}
                    placeholder="https://…"
                    placeholderTextColor={colors.placeholder}
                    autoCapitalize="none"
                    keyboardType="url"
                    maxLength={2048}
                    editable={!working}
                    style={field}
                  />
                </View>
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
              <View style={{ gap: 4, marginTop: 6 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    needsPhoto ? "Add a photo to save" : "Save"
                  }
                  accessibilityState={{
                    disabled: working || needsPhoto,
                    busy: working,
                  }}
                  disabled={working || needsPhoto}
                  onPress={() => void save()}
                  style={({ pressed }) => ({
                    height: 60,
                    borderRadius: 22,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    backgroundColor: needsPhoto ? "#9A9590" : colors.ink,
                    opacity: pressed ? 0.85 : 1,
                    ...(needsPhoto ? {} : shadow(0.25)),
                  })}
                >
                  {working ? (
                    <ActivityIndicator color={colors.yellow} />
                  ) : (
                    <Icon name="check" size={20} color={colors.yellow} />
                  )}
                  <Text
                    style={{
                      fontFamily: fonts.bold,
                      fontSize: 17,
                      color: colors.white,
                    }}
                  >
                    Save
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={working}
                  onPress={cancel}
                  style={{
                    height: 44,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.bold,
                      fontSize: 15,
                      color: "#4B475A",
                    }}
                  >
                    Cancel
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </Page>
    </KeyboardAvoidingView>
  );
}
