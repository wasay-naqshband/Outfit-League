import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Pressable,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Body,
  Button,
  ErrorState,
  Heading,
  Icon,
  Page,
  RoundButton,
} from "../../src/components/ui";
import { Sheet, lookDate, useTwinkle } from "../../src/components/AiLooks";
import { TactileButton, useReduceMotion } from "../../src/components/ScanHero";
import {
  cleanSourceUrl,
  deleteLibraryItem,
  libraryGarment,
  libraryItem,
} from "../../src/lib/library";
import { useTryOnDraft } from "../../src/lib/tryon-draft";
import { useApp } from "../../src/lib/state";
import { colors, fonts, gradients, shadow } from "../../src/theme";
import { art } from "../../src/data";

const SWATCH: Record<string, string> = {
  black: "#14121F",
  white: "#FFFFFF",
  grey: "#9A9590",
  gray: "#9A9590",
  silver: "#C9CCD1",
  beige: "#E4D3B5",
  cream: "#F4ECD6",
  ivory: "#F7F1E1",
  brown: "#7A5235",
  tan: "#C49A6C",
  camel: "#C19A6B",
  khaki: "#B8A77A",
  navy: "#1F2A5C",
  blue: "#3B6FE0",
  denim: "#4A6A9B",
  green: "#2E8B57",
  olive: "#6B7A3A",
  red: "#D63B24",
  burgundy: "#7A1F2E",
  maroon: "#7A1F2E",
  pink: "#FF9BD2",
  purple: "#7B5CD6",
  lavender: "#C9BEFF",
  yellow: "#FFE93B",
  orange: "#F28C28",
  gold: "#D4A72C",
};
// "Black and white" → ["black", "white"]; unknown words get a neutral grey dot.
const colourWords = (color: string) =>
  color
    .toLowerCase()
    .split(/\s*(?:,|\+|\/|&|\band\b)\s*/)
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 3);
const swatch = (word: string) =>
  SWATCH[word] ??
  Object.entries(SWATCH).find(([name]) => word.includes(name))?.[1] ??
  "#B9B3A3";
const tagList = (tags: string) =>
  tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

function useFloat(off: boolean) {
  const y = useRef(new Animated.Value(0)).current;
  useFocusEffect(
    useCallback(() => {
      if (off) return;
      const ease = Easing.inOut(Easing.ease);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(y, {
            toValue: -4,
            duration: 1600,
            easing: ease,
            useNativeDriver: true,
          }),
          Animated.timing(y, {
            toValue: 0,
            duration: 1600,
            easing: ease,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => {
        loop.stop();
        y.setValue(0);
      };
    }, [off, y]),
  );
  return y;
}

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants" as const,
};

export default function LibraryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useApp();
  const query = useQuery({
    queryKey: ["library-item", session?.user.id, id],
    queryFn: () => libraryItem(id),
    enabled: !!session && !!id,
    refetchInterval: 240000,
  });
  const [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [broken, setBroken] = useState(false);
  const client = useQueryClient(),
    draft = useTryOnDraft();
  const reduce = useReduceMotion();
  const twinkle = useTwinkle();
  const float = useFloat(reduce);
  const pop = useRef(new Animated.Value(reduce ? 1 : 0.6)).current;
  const item = query.data;
  const tags = tagList(item?.tags ?? "");
  useEffect(() => {
    if (!tags.length || reduce) return;
    Animated.spring(pop, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  }, [tags.length, reduce, pop]);

  async function act(action: "delete" | "try") {
    if (busy || !item) return;
    setBusy(true);
    setError("");
    try {
      if (action === "delete") {
        await deleteLibraryItem(item.id);
        client.removeQueries({
          queryKey: ["library-item", session?.user.id, item.id],
        });
        await client.invalidateQueries({ queryKey: ["library"] });
        await client.invalidateQueries({ queryKey: ["explore-save"] });
        setConfirm(false);
        router.replace("/(tabs)/closet");
      } else {
        draft.setGarment(await libraryGarment(item));
        router.push("/(tabs)/try-on");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const wardrobe = item?.kind === "wardrobe";
  const colours = colourWords(item?.color ?? "");
  const source = item?.photoUrl
    ? { uri: item.photoUrl }
    : item?.explore_image
      ? art[item.explore_image]
      : null;
  const photo = (style: object) =>
    source && !broken ? (
      <Image
        source={source}
        cachePolicy="none"
        contentFit="cover"
        contentPosition={{ top: "40%", left: "50%" }}
        onError={() => setBroken(true)}
        style={style}
      />
    ) : (
      <View
        style={[
          style,
          {
            backgroundColor: "#F1EEE4",
            alignItems: "center",
            justifyContent: "center",
          },
        ]}
      >
        <Icon name="hanger" size={40} color={colors.text3} />
      </View>
    );
  const canTry =
    !!item &&
    (!!item.photo_path || !!item.explore_photo_url || !!item.explore_garment);

  return (
    <Page>
      <LinearGradient
        colors={gradients.yellow}
        style={{
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
          paddingTop: 28,
          paddingHorizontal: 20,
          paddingBottom: 20,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          ...shadow(0.1),
        }}
      >
        <RoundButton
          name="arrow-left"
          label="Back"
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace("/(tabs)/closet")
          }
        />
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.bold,
              fontSize: 12,
              letterSpacing: 0.6,
              color: "#6B5A00",
            }}
          >
            {(
              (wardrobe || !item ? "My closet" : "Inspiration") +
              (item?.category ? " · " + item.category : "")
            ).toUpperCase()}
          </Text>
          <Heading size={26} style={{ letterSpacing: -0.9 }}>
            Your piece
          </Heading>
        </View>
        <View
          accessible
          accessibilityLabel="Private"
          style={{
            height: 36,
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
      </LinearGradient>

      <View style={{ padding: 20, paddingTop: 24 }}>
        {!session ? (
          <Button
            title="Sign in to open your item"
            onPress={() => router.push("/auth")}
          />
        ) : query.isPending ? (
          <View style={{ gap: 16 }}>
            <View
              style={{
                height: 410,
                borderRadius: 32,
                backgroundColor: "#ECE7D8",
              }}
            />
            <View
              style={{
                height: 34,
                width: "75%",
                borderRadius: 12,
                backgroundColor: "#ECE7D8",
              }}
            />
            <View
              style={{
                height: 18,
                width: "50%",
                borderRadius: 9,
                backgroundColor: "#ECE7D8",
              }}
            />
          </View>
        ) : query.isError ? (
          <ErrorState
            message="This item couldn’t load. It may have been deleted."
            retry={() => void query.refetch()}
          />
        ) : (
          item && (
            <>
              <View
                style={{
                  height: 410,
                  borderRadius: 32,
                  backgroundColor: "#DCD4FD",
                  overflow: "hidden",
                }}
              >
                <View
                  {...hidden}
                  style={
                    {
                      position: "absolute",
                      inset: 0,
                      flexDirection: "row",
                      flexWrap: "wrap",
                      padding: 7,
                    } as object
                  }
                >
                  {Array.from({ length: 26 * 24 }, (_, i) => (
                    <View
                      key={i}
                      style={{
                        width: 16,
                        height: 16,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <View
                        style={{
                          width: 1.6,
                          height: 1.6,
                          borderRadius: 1,
                          backgroundColor: "rgba(20,18,31,0.09)",
                        }}
                      />
                    </View>
                  ))}
                </View>
                <View
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel={item.name}
                  accessibilityValue={{
                    text: [
                      item.category,
                      item.color,
                      tags.length ? "tagged " + tags.join(", ") : "",
                    ]
                      .filter(Boolean)
                      .join(", "),
                  }}
                  style={{
                    position: "absolute",
                    top: 26,
                    alignSelf: "center",
                    width: 262,
                    height: 340,
                    padding: 8,
                    borderRadius: 26,
                    backgroundColor: colors.white,
                    transform: [{ rotate: "-3deg" }],
                    ...shadow(0.25),
                  }}
                >
                  {photo({ flex: 1, borderRadius: 20 })}
                </View>
                {!!tags[0] && (
                  <Animated.View
                    {...hidden}
                    style={{
                      position: "absolute",
                      top: 22,
                      right: 22,
                      transform: [{ rotate: "8deg" }, { scale: pop }],
                      backgroundColor: colors.pink,
                      borderWidth: 3,
                      borderColor: colors.white,
                      borderRadius: 14,
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      ...shadow(0.2),
                    }}
                  >
                    <Text style={{ fontFamily: fonts.heading, fontSize: 18 }}>
                      {tags[0]}
                    </Text>
                  </Animated.View>
                )}
                {!!colours.length && (
                  <Animated.View
                    {...hidden}
                    style={
                      {
                        position: "absolute",
                        left: 18,
                        bottom: 26,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        paddingVertical: 6,
                        paddingLeft: 7,
                        paddingRight: 14,
                        borderRadius: 999,
                        backgroundColor: colors.white,
                        borderWidth: 2.5,
                        borderColor: colors.ink,
                        boxShadow: "0 3px 0 #14121F",
                        transform: [{ rotate: "-4deg" }, { translateY: float }],
                      } as object
                    }
                  >
                    <View style={{ flexDirection: "row" }}>
                      {colours.map((c, i) => (
                        <View
                          key={c + i}
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 9,
                            marginLeft: i ? -6 : 0,
                            backgroundColor: swatch(c),
                            borderWidth: 1.5,
                            borderColor: colors.ink,
                          }}
                        />
                      ))}
                    </View>
                    <Text
                      numberOfLines={1}
                      style={{
                        maxWidth: 160,
                        fontFamily: fonts.bold,
                        fontSize: 13,
                        textTransform: "capitalize",
                      }}
                    >
                      {colours.join(" + ")}
                    </Text>
                  </Animated.View>
                )}
                <Animated.View
                  {...hidden}
                  style={{
                    position: "absolute",
                    left: 24,
                    top: 52,
                    opacity: twinkle,
                  }}
                >
                  <Icon name="sparkles" size={22} color={colors.yellow} />
                </Animated.View>
                <Animated.View
                  {...hidden}
                  style={{
                    position: "absolute",
                    right: 26,
                    top: 196,
                    opacity: twinkle,
                  }}
                >
                  <Icon name="sparkles" size={18} color={colors.white} />
                </Animated.View>
              </View>

              <Text
                accessibilityRole="header"

                numberOfLines={3}
                style={{
                  marginTop: 22,
                  fontFamily: fonts.heading,
                  fontSize: 31,
                  lineHeight: 34,
                  letterSpacing: -1.1,
                  color: colors.ink,
                }}
              >
                {item.name}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 12,
                  marginTop: 12,
                }}
              >
                {!!item.category && (
                  <View
                    style={{
                      height: 34,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      backgroundColor: colors.white,
                      borderWidth: 1.5,
                      borderColor: "#E6E1D2",
                    }}
                  >
                    <Icon name="shirt" size={16} />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13 }}>
                      {item.category}
                    </Text>
                  </View>
                )}
                {tags.slice(1).map((tag) => (
                  <View
                    key={tag}
                    style={{
                      height: 34,
                      justifyContent: "center",
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      backgroundColor: "#FFE1F1",
                      borderWidth: 1.5,
                      borderColor: "#FFB8DD",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: fonts.bold,
                        fontSize: 13,
                        color: "#8A1F5C",
                      }}
                    >
                      # {tag}
                    </Text>
                  </View>
                ))}
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Icon name="shopping-bag" size={15} color="#6B6675" />
                  <Text
                    style={{
                      fontFamily: fonts.body,
                      fontSize: 13,
                      color: "#6B6675",
                    }}
                  >
                    {wardrobe ? "From your wardrobe" : "Saved inspiration"} ·
                    Added {lookDate(item.created_at)}
                  </Text>
                </View>
              </View>
              {!!item.notes && (
                <Body style={{ marginTop: 12 }}>{item.notes}</Body>
              )}
              {item.explore_id && (
                <Body style={{ fontSize: 13, marginTop: 8 }}>
                  {item.explore_photo_url
                    ? `Saved from Explore · ${item.brand}`
                    : "Saved Explore sample · illustrated inspiration"}
                </Body>
              )}

              {wardrobe ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="What goes with this? Opens your stylist with this item."
                  onPress={() =>
                    router.push({
                      pathname: "/stylist",
                      params: { item: item.id, name: item.name },
                    })
                  }
                  style={({ pressed }) => ({
                    marginTop: 24,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    paddingVertical: 16,
                    paddingLeft: 16,
                    paddingRight: 14,
                    borderRadius: 24,
                    backgroundColor: colors.ink,
                    opacity: pressed ? 0.9 : 1,
                    ...shadow(0.22),
                  })}
                >
                  <View {...hidden} style={{ width: 52, height: 48 }}>
                    <View
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 2,
                        width: 34,
                        height: 44,
                        borderRadius: 9,
                        borderWidth: 2,
                        borderColor: colors.white,
                        overflow: "hidden",
                        transform: [{ rotate: "-8deg" }],
                      }}
                    >
                      {photo({ flex: 1 })}
                    </View>
                    <View
                      style={{
                        position: "absolute",
                        left: 20,
                        top: 6,
                        width: 30,
                        height: 40,
                        borderRadius: 9,
                        borderWidth: 2,
                        borderColor: colors.white,
                        backgroundColor: colors.yellow,
                        alignItems: "center",
                        justifyContent: "center",
                        transform: [{ rotate: "9deg" }],
                      }}
                    >
                      <Icon name="sparkles" size={14} />
                    </View>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Heading size={18} style={{ color: colors.white }}>
                      What goes with this?
                    </Heading>
                    <Text
                      style={{
                        fontFamily: fonts.body,
                        fontSize: 13,
                        color: "#D9D6E3",
                      }}
                    >
                      Your stylist builds a fit around it.
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: colors.yellow,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="arrow-right" size={20} />
                  </View>
                </Pressable>
              ) : (
                // Inspiration isn't owned yet: trying it on and shopping stay.
                <View style={{ gap: 12, marginTop: 24 }}>
                  {canTry && (
                    <Button
                      icon="sparkles"
                      title={busy ? "Please wait…" : "Try this on"}
                      disabled={busy}
                      onPress={() => void act("try")}
                    />
                  )}
                  <Button
                    secondary
                    icon="shopping-bag"
                    title="Shop similar styles"
                    disabled={busy}
                    onPress={() =>
                      router.push({
                        pathname: "/shop",
                        params: { library: item.id },
                      })
                    }
                  />
                  {item.source_url && (
                    <Button
                      secondary
                      title="Open original source"
                      onPress={() => {
                        const url = cleanSourceUrl(item.source_url!);
                        if (url)
                          void Linking.openURL(url).catch(() =>
                            setError("This link couldn’t open."),
                          );
                      }}
                    />
                  )}
                </View>
              )}
              {!!error && !confirm && (
                <Body style={{ marginTop: 12, color: "#A3321F" }}>{error}</Body>
              )}

              <View
                style={{
                  flexDirection: "row",
                  gap: 12,
                  marginTop: 22,
                  marginBottom: 20,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() =>
                    router.push({
                      pathname: "/library-edit",
                      params: { id: item.id },
                    })
                  }
                  style={({ pressed }) => ({
                    flex: 1,
                    height: 54,
                    borderRadius: 18,
                    borderWidth: 2,
                    borderColor: colors.ink,
                    backgroundColor: colors.white,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    transform: [{ translateY: pressed && !reduce ? 2 : 0 }],
                  })}
                >
                  <Icon name="edit-2" size={18} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>
                    Edit item
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete item"
                  disabled={busy}
                  onPress={() => {
                    setError("");
                    setConfirm(true);
                  }}
                  style={({ pressed }) => ({
                    flex: 1,
                    height: 54,
                    borderRadius: 18,
                    borderWidth: 2,
                    borderColor: "#F2C9C0",
                    backgroundColor: "#FFF3F0",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    transform: [{ translateY: pressed && !reduce ? 2 : 0 }],
                  })}
                >
                  <Icon name="trash-2" size={18} color="#B3301C" />
                  <Text
                    style={{
                      fontFamily: fonts.bold,
                      fontSize: 16,
                      color: "#B3301C",
                    }}
                  >
                    Delete
                  </Text>
                </Pressable>
              </View>

              <Sheet
                visible={confirm}
                onClose={() => !busy && setConfirm(false)}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <View
                    {...hidden}
                    style={{
                      width: 72,
                      height: 88,
                      borderRadius: 18,
                      borderWidth: 3,
                      borderColor: colors.white,
                      overflow: "hidden",
                      transform: [{ rotate: "-4deg" }],
                      ...shadow(0.15),
                    }}
                  >
                    {photo({ flex: 1 })}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Heading size={24}>Delete this piece?</Heading>
                    <Text
                      numberOfLines={2}
                      style={{
                        fontFamily: fonts.body,
                        fontSize: 13,
                        color: "#6B6675",
                      }}
                    >
                      {item.name}
                    </Text>
                  </View>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    backgroundColor: "#FFE7E1",
                    borderRadius: 18,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                  }}
                >
                  <Icon name="alert-triangle" size={20} color="#A3321F" />
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: fonts.body,
                      fontSize: 14,
                      color: "#5C1D12",
                    }}
                  >
                    It’ll be removed from your closet. This can’t be undone.
                    Looks you already made stay saved.
                  </Text>
                </View>
                {!!error && (
                  <Text
                    accessibilityLiveRegion="polite"
                    style={{
                      fontFamily: fonts.medium,
                      fontSize: 14,
                      color: "#A3321F",
                    }}
                  >
                    {error}
                  </Text>
                )}
                <View
                  style={{
                    height: 62,
                    borderRadius: 20,
                    backgroundColor: colors.ink,
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Delete item"
                    accessibilityState={{ disabled: busy, busy }}
                    disabled={busy}
                    onPress={() => void act("delete")}
                    style={({ pressed }) => ({
                      height: 58,
                      marginTop: pressed ? 4 : 0,
                      borderRadius: 20,
                      borderWidth: 2.5,
                      borderColor: colors.ink,
                      backgroundColor: "#D63B24",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                    })}
                  >
                    {busy ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Icon name="trash-2" size={20} color={colors.white} />
                    )}
                    <Text
                      style={{
                        fontFamily: fonts.bold,
                        fontSize: 17,
                        color: colors.white,
                      }}
                    >
                      Delete item
                    </Text>
                  </Pressable>
                </View>
                <TactileButton
                  title="Keep it"
                  fill={colors.white}
                  disabled={busy}
                  onPress={() => setConfirm(false)}
                />
              </Sheet>
            </>
          )
        )}
      </View>
    </Page>
  );
}
