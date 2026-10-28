import React, { useEffect, useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { Body, Button, Heading, Icon, type IconName } from "./ui";
import { ProductCard } from "./Lookalikes";
import { PieceOptions } from "./ShopTheLook";
import { TactileButton } from "./ScanHero";
import { analytics } from "../lib/analytics";
import { useApp } from "../lib/state";
import { styleLabel, useOnboarding } from "../lib/onboarding";
import { pieceLink, shopFeed, type Lookalike } from "../lib/tryon-api";
import { colors, fonts, gradients, shadow } from "../theme";

function Entry({
  icon,
  title,
  body,
  tint,
  onPress,
  children,
}: {
  icon: IconName;
  title: string;
  body: string;
  tint: readonly [string, string, ...string[]];
  onPress?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={onPress ? `${title}. ${body}` : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <LinearGradient
        colors={tint}
        style={{
          borderRadius: 24,
          borderWidth: 3,
          borderColor: colors.white,
          padding: 16,
          gap: 14,
          ...shadow(0.08),
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.ink,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name={icon} size={20} color={colors.yellow} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Heading size={18}>{title}</Heading>
            <Text
              style={{ fontFamily: fonts.body, fontSize: 13, color: "#3B3647" }}
            >
              {body}
            </Text>
          </View>
          {onPress && <Icon name="chevron-right" size={22} />}
        </View>
        {children}
      </LinearGradient>
    </Pressable>
  );
}

function RailSkeleton() {
  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          width: 170,
          height: 20,
          borderRadius: 8,
          backgroundColor: "#ECE7D8",
        }}
      />
      <View style={{ flexDirection: "row", gap: 12 }}>
        {[0, 1].map((i) => (
          <View
            key={i}
            style={{
              width: 172,
              height: 300,
              borderRadius: 22,
              backgroundColor: "#ECE7D8",
            }}
          />
        ))}
      </View>
    </View>
  );
}

// Same ids and order as the server's feedRails; each loads on its own.
const RAILS = [
  { id: "style", title: "Picked for your style" },
  { id: "outerwear", title: "Jackets and layers" },
  { id: "tops", title: "Everyday tops" },
  { id: "bottoms", title: "Jeans and trousers" },
  { id: "shoes", title: "Sneakers and shoes" },
  { id: "extras", title: "Bags and accessories" },
];

function Rail({
  id,
  title,
  owner,
  styles,
  opening,
  onOpen,
}: {
  id: string;
  title: string;
  owner?: string;
  styles: string[];
  opening: string;
  onOpen: (item: Lookalike) => void;
}) {
  const rail = useQuery({
    queryKey: ["shop-rail", owner, id, styles.join(",")],
    queryFn: async () => (await shopFeed(styles, id)).rails[0]?.items ?? [],
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });
  if (rail.isPending) return <RailSkeleton />;
  if (rail.isError)
    return (
      <View style={{ gap: 10 }}>
        <Heading size={20}>{title}</Heading>
        <Button
          secondary
          icon="refresh-cw"
          title="Couldn’t load · Retry"
          onPress={() => void rail.refetch()}
        />
      </View>
    );
  if (!rail.data.length) return null;
  return (
    <View style={{ gap: 10 }}>
      <Heading size={20}>{title}</Heading>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -18 }}
        contentContainerStyle={{
          gap: 12,
          paddingHorizontal: 18,
          paddingVertical: 4,
        }}
      >
        {rail.data.map((item) => (
          <ProductCard
            key={item.url}
            item={item}
            busy={opening === item.url}
            disabled={!!opening}
            label="Shop"
            onBuy={() => onOpen(item)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// Closet → Shop: their saved looks and Scan first, then live store picks for
// their department and style. Every card opens the store's own product page.
export function ShopTab({ search }: { search: string }) {
  const { session } = useApp();
  const [typed, setTyped] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setTyped(search.trim()), 500);
    return () => clearTimeout(timer);
  }, [search]);
  const styles = useOnboarding().answers.styles.map(styleLabel);
  const [opening, setOpening] = useState("");
  const [error, setError] = useState("");
  async function open(rail: string, item: Lookalike) {
    if (opening) return;
    setOpening(item.url);
    setError("");
    analytics.track("shop_feed_clicked", {
      rail: rail as "style",
    });
    try {
      await Linking.openURL((await pieceLink(item)).url);
    } catch {
      setError("This store link couldn’t open. Try again.");
    } finally {
      setOpening("");
    }
  }
  return (
    <View style={{ gap: 22 }}>
      <View style={{ gap: 4 }}>
        <Heading size={30} style={{ letterSpacing: -1 }}>
          Shop your next fit.
        </Heading>
        <Body style={{ fontSize: 14 }}>
          Picked for you from US stores. Tap to open the product page.
        </Body>
      </View>
      {typed.length > 1 && (
        <PieceOptions
          piece={{
            part: "accessory" as const,
            name: typed,
            query: typed,
            closetId: null,
          }}
          heading="Results"
        />
      )}
      <View style={{ gap: 12 }}>
        <Entry
          icon="heart"
          title="Your saved looks"
          body="Shop what you’ve saved."
          tint={gradients.pink}
          onPress={() => router.push("/shop-saved")}
        />
        <Entry
          icon="camera"
          title="Scan to shop"
          body="Snap a piece, find it cheaper."
          tint={gradients.mint}
        >
          <View style={{ flexDirection: "row", gap: 10 }}>
            {Platform.OS !== "web" && (
              <TactileButton
                icon="camera"
                title="Take photo"
                style={{ flex: 1.2 }}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/scan",
                    params: { pick: "camera" },
                  })
                }
              />
            )}
            <TactileButton
              icon="image"
              title="Gallery"
              fill={colors.white}
              style={{ flex: 1 }}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/scan",
                  params: { pick: "gallery" },
                })
              }
            />
          </View>
        </Entry>
      </View>
      {RAILS.map((rail) => (
        <Rail
          key={rail.id}
          id={rail.id}
          title={rail.title}
          owner={session?.user.id}
          styles={styles}
          opening={opening}
          onOpen={(item) => void open(rail.id, item)}
        />
      ))}
      {!!error && (
        <Body style={{ fontSize: 13, color: "#A3321F" }}>{error}</Body>
      )}
      <Body style={{ fontSize: 11 }}>
        Prices and stock come from each store. Check the store before you buy.
        We may earn a commission from some links.
      </Body>
    </View>
  );
}
