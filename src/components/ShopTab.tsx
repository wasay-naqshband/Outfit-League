import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Body, Button, Heading, Icon, StickerBadge, type IconName } from "./ui";
import { money } from "./Lookalikes";
import { TactileButton, useReduceMotion } from "./ScanHero";
import { analytics } from "../lib/analytics";
import { useApp } from "../lib/state";
import { styleLabel, useOnboarding } from "../lib/onboarding";
import {
  pieceLink,
  shopFeed,
  shopPiece,
  type Lookalike,
} from "../lib/tryon-api";
import { colors, fonts, shadow } from "../theme";
import { art } from "../data";

// The category list: same ids and order as the server's feedRails. Chips and
// sections render from it, so a new category is one entry here. Empty ones hide.
const CATEGORIES: {
  id: string;
  title: string;
  icon?: IconName;
  fit?: "cover" | "contain";
}[] = [
  { id: "style", title: "Picked for your style", icon: "sparkles" },
  { id: "outerwear", title: "Jackets and layers", icon: "layers" },
  { id: "tops", title: "Everyday tops", icon: "shirt" },
  { id: "bottoms", title: "Jeans and trousers" },
  { id: "shoes", title: "Sneakers and shoes" },
  {
    id: "extras",
    title: "Bags and accessories",
    icon: "shopping-bag",
    fit: "contain",
  },
];

// [tile, see-all fill]. Fixed picks for today's two, then a hash so every
// category keeps its colour.
const ACCENTS: Record<string, [string, string]> = {
  bottoms: ["#CFE3FF", "#E6F0FF"],
  extras: ["#FFD9C2", "#FFEADC"],
};
const CYCLE: [string, string][] = [
  ["#D7F6E3", "#EAFBF1"],
  ["#DCD4FD", "#EEEAFF"],
  ["#FFE1F1", "#FFF0F7"],
  ["#FFF1B8", "#FFF8D9"],
];
function accent(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return ACCENTS[id] ?? CYCLE[Math.abs(hash) % CYCLE.length]!;
}

const hard = (y: number): ViewStyle =>
  Platform.select({
    web: { boxShadow: `0px ${y}px 0px ${colors.ink}` } as ViewStyle,
    default: {
      shadowColor: colors.ink,
      shadowOffset: { width: 0, height: y },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
  })!;
const soft = (color: string, y: number, blur: number): ViewStyle =>
  Platform.select({
    web: { boxShadow: `0px ${y}px ${blur}px ${color}` } as ViewStyle,
    default: {
      shadowColor: color,
      shadowOffset: { width: 0, height: y },
      shadowOpacity: 1,
      shadowRadius: blur / 2,
      elevation: 5,
    },
  })!;
const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants" as const,
  pointerEvents: "none" as const,
};

function ShopProductCard({
  item,
  index,
  fit = "contain",
  width = 164,
  busy,
  disabled,
  onShop,
}: {
  item: Lookalike;
  index: number;
  fit?: "cover" | "contain";
  width?: ViewStyle["width"];
  busy: boolean;
  disabled: boolean;
  onShop: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const price = money(item.price);
  return (
    <View
      style={{
        width,
        backgroundColor: colors.white,
        borderRadius: 24,
        padding: 8,
        ...soft("rgba(20,18,31,0.10)", 10, 24),
      }}
    >
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${item.title}, ${item.store}, ${price}`}
        disabled={disabled}
        onPress={onShop}
      >
        <View
          style={{
            height: 184,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: "#EFEBE0",
            overflow: "hidden",
            backgroundColor: broken
              ? "#F1EEE4"
              : fit === "cover"
                ? "#ECE8DD"
                : colors.white,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {broken ? (
            <Icon name="hanger" size={36} color={colors.text3} />
          ) : (
            <Image
              source={{ uri: item.image }}
              contentFit={fit}
              contentPosition={{ left: "50%", top: "20%" }}
              onError={() => setBroken(true)}
              style={
                fit === "cover"
                  ? { width: "100%", height: "100%" }
                  : { position: "absolute", inset: 14 }
              }
            />
          )}
        </View>
        <View
          {...hidden}
          style={{
            position: "absolute",
            left: -4,
            top: 184 - 24,
            backgroundColor: colors.yellow,
            borderWidth: 2.5,
            borderColor: colors.ink,
            borderRadius: 12,
            paddingHorizontal: 8,
            paddingVertical: 2,
            transform: [{ rotate: index % 2 ? "3deg" : "-4deg" }],
            ...hard(3),
          }}
        >
          <Text style={{ fontFamily: fonts.heading, fontSize: 18 }}>
            {price}
          </Text>
        </View>
      </Pressable>
      <View style={{ paddingTop: 20, paddingHorizontal: 4, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.bold,
            fontSize: 12,
            letterSpacing: 0.3,
            textTransform: "uppercase",
            color: colors.text3,
          }}
        >
          {item.store}
        </Text>
        <Text
          numberOfLines={2}
          style={{
            fontFamily: fonts.medium,
            fontSize: 14,
            lineHeight: 18,
            height: 36,
          }}
        >
          {item.title}
        </Text>
      </View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Shop at ${item.store}, opens store`}
        disabled={disabled}
        onPress={onShop}
        style={({ pressed }) => ({
          marginTop: 10,
          height: 44,
          borderRadius: 15,
          backgroundColor: colors.ink,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: disabled && !busy ? 0.6 : 1,
          transform: [{ translateY: pressed ? 2 : 0 }],
        })}
      >
        <Icon name="shopping-bag" size={17} color={colors.yellow} />
        <Text
          style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.white }}
        >
          {busy ? "Opening…" : "Shop now"}
        </Text>
        <Icon name="arrow-right" size={13} color={colors.white} />
      </Pressable>
    </View>
  );
}

export function Grid({
  items,
  fit,
  opening,
  onShop,
}: {
  items: Lookalike[];
  fit?: "cover" | "contain";
  opening: string;
  onShop: (item: Lookalike) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {items.map((item, i) => (
        <View key={item.url} style={{ width: "47.5%", flexGrow: 1 }}>
          <ShopProductCard
            item={item}
            index={i}
            fit={fit}
            width="100%"
            busy={opening === item.url}
            disabled={!!opening}
            onShop={() => onShop(item)}
          />
        </View>
      ))}
    </View>
  );
}

export function Bone({ style }: { style: ViewStyle }) {
  const reduce = useReduceMotion();
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.55,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, pulse]);
  return (
    <Animated.View
      style={[{ backgroundColor: "#ECE7D8", opacity: pulse }, style]}
    />
  );
}

function SectionSkeleton() {
  return (
    <View style={{ gap: 14 }}>
      <Bone style={{ width: 210, height: 38, borderRadius: 12 }} />
      <View style={{ flexDirection: "row", gap: 12, overflow: "hidden" }}>
        {[0, 1, 2].map((i) => (
          <Bone key={i} style={{ width: 164, height: 300, borderRadius: 24 }} />
        ))}
      </View>
    </View>
  );
}

function ShopCategorySection({
  category,
  items,
  opening,
  onShop,
  onSeeAll,
}: {
  category: (typeof CATEGORIES)[number];
  items: Lookalike[];
  opening: string;
  onShop: (item: Lookalike) => void;
  onSeeAll: () => void;
}) {
  const [tile, fill] = accent(category.id);
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          {...hidden}
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: tile,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={category.icon ?? "hanger"} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <Heading size={22} style={{ letterSpacing: -0.7 }}>
            {category.title}
          </Heading>
          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: 13,
              color: colors.text3,
            }}
          >
            {items.length} picks for you
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`See all ${category.title}`}
          onPress={onSeeAll}
          style={{
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 14 }}>See all</Text>
          <Icon name="chevron-right" size={18} />
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={176}
        decelerationRate="fast"
        style={{ marginHorizontal: -18 }}
        contentContainerStyle={{
          gap: 12,
          paddingTop: 14,
          paddingHorizontal: 18,
          paddingBottom: 18,
        }}
      >
        {items.map((item, i) => (
          <ShopProductCard
            key={item.url}
            item={item}
            index={i}
            fit={category.fit ?? "cover"}
            busy={opening === item.url}
            disabled={!!opening}
            onShop={() => onShop(item)}
          />
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`See all ${items.length} ${category.title}`}
          onPress={onSeeAll}
          style={{
            width: 120,
            borderRadius: 24,
            borderWidth: 2,
            borderStyle: "dashed",
            borderColor: "rgba(20,18,31,0.18)",
            backgroundColor: fill,
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: colors.ink,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="arrow-right" size={22} color={colors.yellow} />
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14 }}>
            See all {items.length}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Chip({
  label,
  dot,
  selected,
  onPress,
}: {
  label: string;
  dot?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        height: 40,
        borderRadius: 999,
        paddingHorizontal: 16,
        borderWidth: 2,
        borderColor: selected ? colors.ink : "#E6E1D2",
        backgroundColor: selected ? colors.ink : colors.white,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      {selected && !dot ? (
        <Icon name="sparkles" size={14} color={colors.yellow} />
      ) : dot ? (
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: dot,
          }}
        />
      ) : (
        <Icon name="sparkles" size={14} />
      )}
      <Text
        style={{
          fontFamily: selected ? fonts.bold : fonts.medium,
          fontSize: 14,
          color: selected ? colors.white : colors.ink,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// Decorative: a sample find with scan brackets and a moving scan line.
function ScanArt() {
  const reduce = useReduceMotion();
  const line = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) {
      pop.setValue(1);
      return;
    }
    Animated.spring(pop, {
      toValue: 1,
      delay: 500,
      friction: 5,
      useNativeDriver: true,
    }).start();
    const loop = Animated.loop(
      Animated.timing(line, {
        toValue: 1,
        duration: 2600,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, line, pop]);
  const corner = (top: boolean, left: boolean): ViewStyle => ({
    position: "absolute",
    width: 18,
    height: 18,
    borderColor: colors.white,
    [top ? "top" : "bottom"]: 10,
    [left ? "left" : "right"]: 10,
    [top ? "borderTopWidth" : "borderBottomWidth"]: 3,
    [left ? "borderLeftWidth" : "borderRightWidth"]: 3,
    [`border${top ? "Top" : "Bottom"}${left ? "Left" : "Right"}Radius`]: 6,
  });
  return (
    <View {...hidden} style={{ width: 112, height: 134 }}>
      <View
        style={{
          width: 104,
          height: 124,
          borderRadius: 18,
          borderWidth: 5,
          borderColor: colors.white,
          overflow: "hidden",
          backgroundColor: colors.white,
          transform: [{ rotate: "5deg" }],
          ...shadow(0.18),
        }}
      >
        <Image
          source={require("../../assets/examples/scan-shop-sample.jpg")}
          contentFit="cover"
          style={{ flex: 1 }}
        />
        {[true, false].flatMap((top) =>
          [true, false].map((left) => (
            <View key={`${top}${left}`} style={corner(top, left)} />
          )),
        )}
        {!reduce && (
          <Animated.View
            style={{
              position: "absolute",
              left: 8,
              right: 8,
              top: 0,
              height: 3,
              borderRadius: 2,
              backgroundColor: "#3BE08F",
              transform: [
                {
                  translateY: line.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 102],
                  }),
                },
              ],
            }}
          />
        )}
      </View>
      <Animated.View
        style={{
          position: "absolute",
          left: -14,
          bottom: 0,
          transform: [{ scale: pop }],
        }}
      >
        <StickerBadge
          color={colors.yellow}
          rotate="-6deg"
          size={14}
          style={{ borderWidth: 2.5, borderColor: colors.ink, ...hard(3) }}
        >
          Found it
        </StickerBadge>
      </Animated.View>
    </View>
  );
}

function ScanCard() {
  const scan = (pick: "camera" | "gallery") =>
    router.push({ pathname: "/(tabs)/scan", params: { pick } });
  return (
    <LinearGradient
      colors={["#D7F6E3", "#9FE6BE"]}
      start={{ x: 0.3, y: 0 }}
      end={{ x: 0.7, y: 1 }}
      style={{
        borderRadius: 28,
        paddingTop: 18,
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 16,
        overflow: "hidden",
        ...soft("rgba(18,122,85,0.18)", 14, 30),
      }}
    >
      <View
        {...hidden}
        style={{
          position: "absolute",
          top: -50,
          right: -40,
          width: 170,
          height: 170,
          borderRadius: 85,
          backgroundColor: "rgba(255,255,255,0.35)",
        }}
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1, gap: 8 }}>
          <View
            {...hidden}
            style={{
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: colors.ink,
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
          >
            <Icon name="sparkles" size={12} color="#3BE08F" />
            <Text
              style={{
                fontFamily: fonts.bold,
                fontSize: 12,
                color: colors.white,
              }}
            >
              Snap · match · save
            </Text>
          </View>
          <Heading size={26} style={{ letterSpacing: -0.8 }}>
            Scan to shop
          </Heading>
          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: 14,
              lineHeight: 19,
              color: "#1F4A38",
            }}
          >
            Snap a piece you love. We find it, or something cheaper.
          </Text>
        </View>
        <ScanArt />
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {Platform.OS !== "web" && (
          <TactileButton
            icon="camera"
            title="Take photo"
            style={{ flex: 1.4 }}
            onPress={() => scan("camera")}
          />
        )}
        <TactileButton
          icon="image"
          title="Gallery"
          fill={colors.white}
          style={{ flex: 1 }}
          onPress={() => scan("gallery")}
        />
      </View>
    </LinearGradient>
  );
}

function SavedCard({ thumbs }: { thumbs: string[] }) {
  const pics = [0, 1].map((i) =>
    thumbs[i] ? { uri: thumbs[i] } : i ? art.rust : art.navy,
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Your saved looks. Shop the pieces in looks you've saved."
      onPress={() => router.push("/shop-saved")}
      style={({ pressed }) => ({
        transform: [{ translateY: pressed ? 2 : 0 }],
      })}
    >
      <LinearGradient
        colors={["#FFE1F1", "#FFB8DD"]}
        start={{ x: 0, y: 0.3 }}
        end={{ x: 1, y: 0.7 }}
        style={{
          borderRadius: 24,
          paddingVertical: 12,
          paddingLeft: 12,
          paddingRight: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          ...soft("rgba(255,111,181,0.2)", 10, 24),
        }}
      >
        <View {...hidden} style={{ width: 66, height: 54 }}>
          {pics.map((pic, i) => (
            <Image
              key={i}
              source={pic}
              contentFit="cover"
              style={{
                position: "absolute",
                left: i ? 26 : 2,
                top: 4,
                width: 36,
                height: 46,
                borderRadius: 10,
                borderWidth: 2.5,
                borderColor: colors.white,
                backgroundColor: "#F1EEE4",
                transform: [{ rotate: i ? "7deg" : "-8deg" }],
              }}
            />
          ))}
          <View
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: colors.ink,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="heart-filled" size={11} color={colors.pink} />
          </View>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Heading size={18}>Your saved looks</Heading>
          <Text
            style={{ fontFamily: fonts.body, fontSize: 13, color: "#5C2347" }}
          >
            Shop the pieces in looks you’ve saved.
          </Text>
        </View>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.ink,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="arrow-right" size={20} color={colors.yellow} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function SearchResults({
  query,
  opening,
  onShop,
}: {
  query: string;
  opening: string;
  onShop: (item: Lookalike) => void;
}) {
  const result = useQuery({
    queryKey: ["shop-piece", query],
    queryFn: () => shopPiece(query),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });
  if (result.isPending)
    return (
      <View style={{ flexDirection: "row", gap: 12 }}>
        {[0, 1].map((i) => (
          <Bone key={i} style={{ flex: 1, height: 300, borderRadius: 24 }} />
        ))}
      </View>
    );
  if (result.isError) return <Retry onPress={() => void result.refetch()} />;
  if (!result.data.items.length) return <Body>No matches for ‘{query}’</Body>;
  return <Grid items={result.data.items} opening={opening} onShop={onShop} />;
}

export function Retry({ onPress }: { onPress: () => void }) {
  return (
    <View
      style={{
        borderRadius: 22,
        backgroundColor: colors.white,
        padding: 16,
        gap: 12,
        ...shadow(0.06),
      }}
    >
      <Body>Couldn’t load picks</Body>
      <Button secondary icon="refresh-cw" title="Retry" onPress={onPress} />
    </View>
  );
}

// Closet → Shop: Scan and saved looks first, then live store picks per
// category. Every card opens the store's own product page.
export function ShopTab({
  search,
  thumbs = [],
}: {
  search: string;
  thumbs?: string[];
}) {
  const { session } = useApp();
  const [typed, setTyped] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setTyped(search.trim()), 500);
    return () => clearTimeout(timer);
  }, [search]);
  const styles = useOnboarding().answers.styles.map(styleLabel);
  const [opening, setOpening] = useState("");
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const rails = useQueries({
    queries: CATEGORIES.map((category) => ({
      queryKey: ["shop-rail", session?.user.id, category.id, styles.join(",")],
      queryFn: async () =>
        (await shopFeed(styles, category.id)).rails[0]?.items ?? [],
      staleTime: 1000 * 60 * 60,
      retry: 1,
    })),
  });
  const loaded = CATEGORIES.map((category, i) => ({
    category,
    rail: rails[i]!,
  }));
  const shown = loaded.filter(({ rail }) => rail.data?.length);
  const pending = rails.some((rail) => rail.isPending);
  const failed = loaded.filter(({ rail }) => rail.isError);
  const current = shown.find(({ category }) => category.id === picked);

  async function open(rail: string | null, item: Lookalike) {
    if (opening) return;
    setOpening(item.url);
    setError("");
    if (rail) analytics.track("shop_feed_clicked", { rail: rail as "style" });
    try {
      await Linking.openURL((await pieceLink(item)).url);
    } catch {
      setError("This store link couldn’t open. Try again.");
    } finally {
      setOpening("");
    }
  }

  return (
    <View style={{ gap: 18, paddingBottom: 100 }}>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Heading size={30} style={{ letterSpacing: -1.1 }}>
            Shop your next
          </Heading>
          <StickerBadge
            rotate="-5deg"
            size={24}
            style={{
              borderWidth: 3,
              borderColor: colors.white,
              borderRadius: 14,
            }}
          >
            fit.
          </StickerBadge>
        </View>
        <Text
          style={{ fontFamily: fonts.body, fontSize: 14, color: colors.text2 }}
        >
          Picked for you from US stores.
        </Text>
      </View>
      {typed.length > 1 ? (
        <SearchResults
          query={typed}
          opening={opening}
          onShop={(item) => void open(null, item)}
        />
      ) : (
        <>
          <ScanCard />
          <SavedCard thumbs={thumbs} />
          {pending && !shown.length ? (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              {[80, 150, 150, 120].map((w, i) => (
                <Bone
                  key={i}
                  style={{ width: w, height: 40, borderRadius: 999 }}
                />
              ))}
            </View>
          ) : (
            !!shown.length && (
              <ScrollView
                horizontal
                accessibilityRole="tablist"
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -18, marginTop: 8 }}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 18 }}
              >
                <Chip
                  label="For you"
                  selected={!current}
                  onPress={() => setPicked(null)}
                />
                {shown.map(({ category }) => (
                  <Chip
                    key={category.id}
                    label={category.title}
                    dot={accent(category.id)[0]}
                    selected={current?.category.id === category.id}
                    onPress={() => setPicked(category.id)}
                  />
                ))}
              </ScrollView>
            )
          )}
          {current ? (
            <Grid
              items={current.rail.data!}
              fit={current.category.fit ?? "cover"}
              opening={opening}
              onShop={(item) => void open(current.category.id, item)}
            />
          ) : (
            <>
              {loaded.map(({ category, rail }) =>
                rail.isPending ? (
                  <SectionSkeleton key={category.id} />
                ) : rail.data?.length ? (
                  <ShopCategorySection
                    key={category.id}
                    category={category}
                    items={rail.data}
                    opening={opening}
                    onShop={(item) => void open(category.id, item)}
                    onSeeAll={() => setPicked(category.id)}
                  />
                ) : null,
              )}
              {!!failed.length && (
                <Retry
                  onPress={() =>
                    failed.forEach(({ rail }) => void rail.refetch())
                  }
                />
              )}
              {!pending && !shown.length && !failed.length && (
                <View
                  style={{
                    borderRadius: 24,
                    borderWidth: 2,
                    borderStyle: "dashed",
                    borderColor: "rgba(20,18,31,0.18)",
                    padding: 20,
                    gap: 4,
                  }}
                >
                  <Heading size={18}>Fresh picks are on the way</Heading>
                  <Body style={{ fontSize: 14 }}>
                    Scan something you like to shop it now.
                  </Body>
                </View>
              )}
            </>
          )}
        </>
      )}
      {!!error && (
        <Body style={{ fontSize: 13, color: "#A3321F" }}>{error}</Body>
      )}
      <View
        style={{
          flexDirection: "row",
          gap: 10,
          borderRadius: 18,
          backgroundColor: "#F4F0E2",
          paddingVertical: 12,
          paddingHorizontal: 14,
        }}
      >
        <Icon name="help-circle" size={16} color={colors.text2} />
        <Text
          style={{
            flex: 1,
            fontFamily: fonts.body,
            fontSize: 12.5,
            lineHeight: 17,
            color: colors.text2,
          }}
        >
          Prices and stock come from each store, so check before you buy. We may
          earn a commission from some links.
        </Text>
      </View>
    </View>
  );
}
