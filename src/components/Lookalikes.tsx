import React, { useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Body, Button, Heading, Icon } from "./ui";
import { CookingLoader, LOOKALIKE_MESSAGES } from "./CookingLoader";
import {
  fetchLookalikes,
  lookalikeLink,
  type Lookalike,
} from "../lib/tryon-api";
import { friendlyError } from "../types/tryon";
import { analytics } from "../lib/analytics";
import { colors, fonts, shadow } from "../theme";

export const money = (price: number | null) =>
  price === null
    ? "See price"
    : "$" + (Number.isInteger(price) ? price : price.toFixed(2));

// "Similar lookalikes": similar items from US stores, found only when asked.
// Free sees two; Pro sees them all. Buy opens the store's own product page.
export function Lookalikes({ id }: { id: string }) {
  const [asked, setAsked] = useState(false);
  const [opening, setOpening] = useState(-1);
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["lookalikes", id],
    queryFn: () => fetchLookalikes(id),
    enabled: asked,
    staleTime: Infinity,
    retry: false,
  });
  // Lookalike search isn't set up on this server: hide the section.
  if (query.error?.message === "LOOKALIKES_UNAVAILABLE") return null;

  const items = query.data?.items ?? [];
  const cheapest = Math.min(...items.map((item) => item.price ?? Infinity));
  const badge = (i: number) =>
    i === 0 && items[0]?.score !== undefined
      ? "Closest match"
      : items[i]!.price === cheapest
        ? "Cheapest"
        : null;
  async function buy(index: number) {
    if (opening >= 0) return;
    const b = badge(index);
    analytics.track("lookalike_clicked", {
      badge:
        b === "Closest match"
          ? "closest"
          : b === "Cheapest"
            ? "cheapest"
            : "other",
    });
    setOpening(index);
    setError("");
    try {
      const { url } = await lookalikeLink(id, index);
      await Linking.openURL(url);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setOpening(-1);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Heading size={22}>Similar lookalikes</Heading>
        <Text style={{ fontSize: 20 }}>🛍️</Text>
      </View>
      {!asked ? (
        <Button
          secondary
          icon="search"
          title="Find similar lookalikes"
          onPress={() => {
            setAsked(true);
            analytics.track("lookalikes_requested", { from: "result" });
          }}
        />
      ) : query.isError ? (
        <Button
          secondary
          title="Couldn’t load lookalikes · Try again"
          onPress={() => void query.refetch()}
        />
      ) : query.data && !query.data.items.length ? (
        <Body style={{ fontSize: 14 }}>
          No close lookalikes found for this item yet.
        </Body>
      ) : query.isPending ? (
        // Same full-screen wait as the try-on; closing goes back to the result.
        <Modal visible animationType="fade" statusBarTranslucent>
          <CookingLoader
            fullScreen
            messages={LOOKALIKE_MESSAGES}
            seconds={20}
            onClose={() => setAsked(false)}
          />
        </Modal>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
        >
          {query.data!.items.map((item, i) => (
            <ProductCard
              key={item.url}
              item={item}
              badge={badge(i)}
              busy={opening === i}
              disabled={opening >= 0}
              onBuy={() => void buy(i)}
            />
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
    </View>
  );
}

// One product: photo, price, name, store and Buy. Shared with Shop the look.
export function ProductCard({
  item,
  badge,
  busy,
  disabled,
  onBuy,
  label = "Buy",
}: {
  item: Lookalike;
  badge?: string | null;
  busy: boolean;
  disabled: boolean;
  onBuy: () => void;
  label?: string;
}) {
  return (
    <View
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
        {!!badge && (
          <Text
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              overflow: "hidden",
              borderRadius: 10,
              paddingHorizontal: 8,
              paddingVertical: 3,
              backgroundColor: badge === "Cheapest" ? "#127A55" : colors.ink,
              color: colors.white,
              fontFamily: fonts.bold,
              fontSize: 11,
            }}
          >
            {badge}
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
          lineHeight: 17,
          height: 34,
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
        title={busy ? "Opening…" : label}
        icon="shopping-bag"
        disabled={disabled}
        style={{ minHeight: 42, borderRadius: 14 }}
        onPress={onBuy}
      />
    </View>
  );
}
