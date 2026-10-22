import React, { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Body,
  Button,
  FlatHeader,
  Heading,
  LoadingSkeleton,
  Page,
} from "../src/components/ui";
import { Bullets, Swatches } from "../src/components/Stylist";
import { useApp } from "../src/lib/state";
import { supabase } from "../src/lib/supabase";
import {
  colorProfile,
  pickOutfit,
  type ColorProfile,
  type OutfitPick,
} from "../src/lib/tryon-api";
import {
  libraryGarment,
  libraryItem,
  type LibraryItem,
} from "../src/lib/library";
import { useTryOnDraft } from "../src/lib/tryon-draft";
import { friendlyError } from "../src/types/tryon";
import { colors, fonts } from "../src/theme";

const OCCASIONS = [
  ["Today ☀️", "An everyday outfit for today"],
  ["Date night 💕", "A date night"],
  ["Work 💼", "A day at the office"],
  ["Wedding 💍", "A wedding, as a guest"],
  ["Party 🎉", "A party tonight"],
  ["Weekend 🛋️", "A relaxed weekend"],
] as const;
// The try-on provider wears clothing only, not shoes or accessories.
const WEARABLE = ["Tops", "Shirts", "Hoodies", "Jackets", "Bottoms", "Dresses"];

const card = {
  backgroundColor: colors.white,
  borderRadius: 28,
  padding: 20,
  gap: 14,
} as const;

export default function Stylist() {
  const { session } = useApp();
  const client = useQueryClient();
  const draft = useTryOnDraft();
  const [occasion, setOccasion] = useState<string>(OCCASIONS[0][1]);
  const [details, setDetails] = useState("");
  const [pick, setPick] = useState<
    (OutfitPick & { pieces: LibraryItem[] }) | null
  >(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const palette = useQuery({
    queryKey: ["color-profile", session?.user.id],
    enabled: !!session && !!supabase,
    queryFn: async () => {
      const { data } = await supabase!
        .from("profiles")
        .select("color_profile")
        .single();
      return (data?.color_profile ?? null) as ColorProfile | null;
    },
  });

  async function run(task: string, work: () => Promise<void>) {
    if (busy) return;
    setBusy(task);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy("");
    }
  }
  const styleMe = () =>
    run("outfit", async () => {
      const { outfit } = await pickOutfit(
        details.trim() ? `${occasion}. ${details.trim()}` : occasion,
      );
      const pieces = await Promise.all(
        outfit.items.map((id) => libraryItem(id).catch(() => null)),
      );
      setPick({ ...outfit, pieces: pieces.filter((p) => !!p) });
    });
  const findColors = (refresh = false) =>
    run("colors", async () => {
      const { colors } = await colorProfile(refresh);
      client.setQueryData(["color-profile", session?.user.id], colors);
    });
  const tryOutfit = () =>
    run("try", async () => {
      const piece = pick?.pieces.find((p) => WEARABLE.includes(p.category));
      if (piece) draft.setGarment(await libraryGarment(piece));
      router.push("/(tabs)/try-on");
    });
  const wearable = pick?.pieces.some((p) => WEARABLE.includes(p.category));

  return (
    <Page>
      <FlatHeader title="AI Stylist" />
      <View style={{ padding: 20, gap: 18 }}>
        {!session ? (
          <Button
            title="Sign in to meet your stylist"
            onPress={() => router.push("/auth")}
          />
        ) : (
          <>
            <View style={card}>
              <Heading size={24}>What should I wear?</Heading>
              <Body style={{ fontSize: 14 }}>
                Picks an outfit from your closet for the moment.
              </Body>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {OCCASIONS.map(([chip, text]) => (
                  <Pressable
                    key={chip}
                    accessibilityRole="button"
                    accessibilityState={{ selected: occasion === text }}
                    onPress={() => setOccasion(text)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      borderRadius: 18,
                      backgroundColor:
                        occasion === text ? colors.ink : colors.cream,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: fonts.medium,
                        fontSize: 14,
                        color: occasion === text ? colors.white : colors.ink,
                      }}
                    >
                      {chip}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <TextInput
                accessibilityLabel="Details"
                value={details}
                onChangeText={setDetails}
                maxLength={150}
                placeholder="Details? e.g. it’s cold, outdoor, smart casual"
                placeholderTextColor={colors.placeholder}
                style={{
                  backgroundColor: colors.cream,
                  padding: 14,
                  borderRadius: 16,
                  fontFamily: fonts.body,
                  fontSize: 15,
                  color: colors.ink,
                }}
              />
              <Button
                icon="sparkles"
                title={busy === "outfit" ? "Styling you…" : "Style me"}
                disabled={!!busy}
                onPress={() => void styleMe()}
              />
              {pick && (
                <View style={{ gap: 12 }}>
                  <Heading size={21}>{pick.title}</Heading>
                  <Body style={{ fontSize: 15 }}>{pick.why}</Body>
                  {!!pick.pieces.length && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 10 }}
                    >
                      {pick.pieces.map((piece) => (
                        <Pressable
                          key={piece.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Open ${piece.name}`}
                          onPress={() =>
                            router.push({
                              pathname: "/library-item/[id]",
                              params: { id: piece.id },
                            })
                          }
                          style={{ width: 104, gap: 6 }}
                        >
                          <View
                            style={{
                              width: 104,
                              height: 130,
                              borderRadius: 18,
                              overflow: "hidden",
                              backgroundColor: colors.cream,
                            }}
                          >
                            {piece.photoUrl && (
                              <Image
                                source={{ uri: piece.photoUrl }}
                                contentFit="cover"
                                cachePolicy="none"
                                style={{ width: "100%", height: "100%" }}
                              />
                            )}
                          </View>
                          <Text
                            numberOfLines={1}
                            style={{ fontFamily: fonts.medium, fontSize: 13 }}
                          >
                            {piece.name}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}
                  {!!pick.missing.length && (
                    <>
                      <Heading size={16}>Worth adding</Heading>
                      <Bullets items={pick.missing} mark="🛍️" />
                    </>
                  )}
                  {!!pick.tips.length && (
                    <Bullets items={pick.tips} mark="💡" />
                  )}
                  {wearable && (
                    <Button
                      secondary
                      icon="sparkles"
                      title={busy === "try" ? "Getting it ready…" : "Try it on"}
                      disabled={!!busy}
                      onPress={() => void tryOutfit()}
                    />
                  )}
                  {!pick.pieces.length && (
                    <Button
                      secondary
                      icon="plus"
                      title="Add your clothes for picks from your closet"
                      onPress={() =>
                        router.push({
                          pathname: "/library-edit",
                          params: { kind: "wardrobe" },
                        })
                      }
                    />
                  )}
                </View>
              )}
            </View>

            <View style={card}>
              <Heading size={24}>Your colours</Heading>
              {palette.isPending ? (
                <LoadingSkeleton />
              ) : palette.data ? (
                <>
                  <Heading size={20}>{palette.data.season}</Heading>
                  <Body style={{ fontSize: 15 }}>{palette.data.summary}</Body>
                  <Swatches title="Wear these" items={palette.data.best} />
                  <Swatches
                    title="Easy neutrals"
                    items={palette.data.neutrals}
                  />
                  <Swatches
                    title="Keep away from your face"
                    items={palette.data.avoid}
                  />
                  {!!palette.data.tips.length && (
                    <Bullets items={palette.data.tips} mark="💡" />
                  )}
                  <Button
                    secondary
                    title={
                      busy === "colors"
                        ? "Reading your colours…"
                        : "Redo with my current photo"
                    }
                    disabled={!!busy}
                    onPress={() => void findColors(true)}
                  />
                </>
              ) : (
                <>
                  <Body style={{ fontSize: 14 }}>
                    Find the colours that make you glow, from your try-on photo.
                    Use one taken in daylight.
                  </Body>
                  <Button
                    icon="sparkles"
                    title={
                      busy === "colors"
                        ? "Reading your colours…"
                        : "Find my colours"
                    }
                    disabled={!!busy}
                    onPress={() => void findColors()}
                  />
                </>
              )}
              {error.includes("try-on photo") && (
                <Button
                  secondary
                  icon="camera"
                  title="Add your try-on photo"
                  onPress={() => router.push("/my-photo")}
                />
              )}
            </View>
            {!!error && (
              <Body
                style={{
                  padding: 16,
                  borderRadius: 18,
                  backgroundColor: colors.chip,
                }}
              >
                {error}
              </Body>
            )}
            <Body style={{ fontSize: 12, textAlign: "center" }}>
              Advice is AI-generated by Google Gemini. Your closet details and,
              for colours, your try-on photo are sent privately to make it.
            </Body>
          </>
        )}
      </View>
    </Page>
  );
}
