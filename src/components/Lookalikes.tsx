import React, { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Body, Button, Heading, Icon } from "./ui";
import { CookingLoader, LOOKALIKE_MESSAGES } from "./CookingLoader";
import { fetchLookalikes, lookalikePhoto } from "../lib/tryon-api";
import { useTryOnDraft } from "../lib/tryon-draft";
import { friendlyError } from "../types/tryon";
import { colors, fonts, shadow } from "../theme";

const money = (price: number | null) =>
  price === null
    ? "See price"
    : "$" + (Number.isInteger(price) ? price : price.toFixed(2));

// "Cheaper lookalikes": similar items from US stores, cheapest first.
// Free sees two; Pro sees them all. Links go straight to the store for now.
export function Lookalikes({ id }: { id: string }) {
  const draft = useTryOnDraft();
  const [trying, setTrying] = useState(-1);
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["lookalikes", id],
    queryFn: () => fetchLookalikes(id),
    staleTime: Infinity,
    retry: false,
  });
  // Not set up yet, or nothing found: leave the result screen as it was.
  if (query.isError || (query.data && !query.data.items.length)) return null;

  const items = query.data?.items ?? [];
  const cheapest = Math.min(...items.map((item) => item.price ?? Infinity));
  const badge = (i: number) =>
    i === 0 && items[0]?.score !== undefined
      ? "Closest match"
      : items[i]!.price === cheapest
        ? "Cheapest"
        : null;
  async function tryOn(index: number) {
    if (trying >= 0) return;
    setTrying(index);
    setError("");
    try {
      draft.setGarment(await lookalikePhoto(id, index));
      router.push("/(tabs)/try-on");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setTrying(-1);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Heading size={22}>Cheaper lookalikes</Heading>
        <Text style={{ fontSize: 20 }}>💸</Text>
      </View>
      {query.isPending ? (
        // Same animated wait as the try-on, sized to sit inside the result.
        <CookingLoader
          messages={LOOKALIKE_MESSAGES}
          seconds={20}
          height={270}
        />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
        >
          {query.data!.items.map((item, i) => (
            <View
              key={item.url}
              style={{
                width: 172,
                backgroundColor: colors.white,
                borderRadius: 22,
                padding: 10,
                gap: 8,
                ...shadow(0.06),
              }}
            >
              <View>
                <Image
                  source={{ uri: item.image }}
                  contentFit="cover"
                  accessibilityLabel={item.title}
                  style={{ height: 180, borderRadius: 16 }}
                />
                {!!badge(i) && (
                  <Text
                    style={{
                      position: "absolute",
                      top: 8,
                      left: 8,
                      overflow: "hidden",
                      borderRadius: 10,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      backgroundColor:
                        badge(i) === "Cheapest" ? "#127A55" : colors.ink,
                      color: colors.white,
                      fontFamily: fonts.bold,
                      fontSize: 11,
                    }}
                  >
                    {badge(i)}
                  </Text>
                )}
              </View>
              <Text style={{ fontFamily: fonts.heading, fontSize: 20 }}>
                {money(item.price)}
              </Text>
              <Text
                numberOfLines={2}
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 13,
                  minHeight: 34,
                }}
              >
                {item.title}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: fonts.body,
                  fontSize: 12,
                  color: colors.text3,
                }}
              >
                {item.store}
              </Text>
              <Button
                icon="sparkles"
                title={trying === i ? "Getting it…" : "Try it on"}
                disabled={trying >= 0}
                style={{ minHeight: 42, borderRadius: 14 }}
                onPress={() => void tryOn(i)}
              />
              <Button
                secondary
                title="Buy"
                style={{ minHeight: 40, borderRadius: 14 }}
                onPress={() => void Linking.openURL(item.url)}
              />
            </View>
          ))}
          {query.data!.locked > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`See ${query.data!.locked} more lookalikes with Pro`}
              onPress={() =>
                router.push({
                  pathname: "/paywall",
                  params: { source: "feature" },
                })
              }
              style={{
                width: 172,
                backgroundColor: colors.ink,
                borderRadius: 22,
                padding: 16,
                gap: 10,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Icon name="sparkles" size={30} color={colors.yellow} />
              <Text
                style={{
                  fontFamily: fonts.heading,
                  fontSize: 22,
                  color: colors.white,
                  textAlign: "center",
                }}
              >
                +{query.data!.locked} more
              </Text>
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 13,
                  color: colors.white,
                  textAlign: "center",
                }}
              >
                See every lookalike with Pro
              </Text>
            </Pressable>
          )}
        </ScrollView>
      )}
      {!!error && <Body style={{ fontSize: 14 }}>{error}</Body>}
      <Body style={{ fontSize: 11 }}>
        Similar styles from other stores, not the exact item. Prices from Google
        Shopping; check the store before you buy. We may earn a commission from
        some links.
      </Body>
    </View>
  );
}
