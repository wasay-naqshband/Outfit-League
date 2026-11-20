import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Figure, Icon, type IconName } from "./ui";
import { useReduceMotion } from "./ScanHero";
import { sized, type ExploreOutfit } from "../lib/explore";
import {
  productDetails,
  productPrice,
  productSwatch,
} from "../lib/product-detail";
import { colors, fonts, shadow } from "../theme";

const decorative = {
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants" as const,
  pointerEvents: "none" as const,
};
const hardShadow = (pressed: boolean, offset = 4): ViewStyle =>
  Platform.select({
    web: { boxShadow: `0px ${pressed ? 0 : offset}px 0px ${colors.ink}` },
    default: {
      shadowColor: colors.ink,
      shadowOffset: { width: 0, height: pressed ? 0 : offset },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: pressed ? 0 : offset,
    },
  })!;

export function ProductDetailSkeleton({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <View
        style={{
          height: 486 + insets.top,
          backgroundColor: "#F1EEE4",
          borderBottomLeftRadius: 36,
          borderBottomRightRadius: 36,
        }}
      />
      <View
        style={{ padding: 20, gap: 12 }}
        accessibilityLabel="Loading product details"
      >
        {(["70%", "100%", "60%"] as const).map((width, index) => (
          <View
            key={width}
            {...decorative}
            style={{
              width,
              height: index === 1 ? 27 : 16,
              borderRadius: 8,
              backgroundColor: "#E6E1D2",
            }}
          />
        ))}
        <View
          {...decorative}
          style={{
            marginTop: 10,
            height: 74,
            borderRadius: 24,
            backgroundColor: "#E6E1D2",
          }}
        />
      </View>
      <BackButton top={22 + insets.top} onPress={onBack} />
    </View>
  );
}

function BackButton({ top, onPress }: { top: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onPress}
      style={{
        position: "absolute",
        top,
        left: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(255,255,255,0.95)",
        alignItems: "center",
        justifyContent: "center",
        ...shadow(0.12),
      }}
    >
      <Icon name="arrow-left" size={20} />
    </Pressable>
  );
}

export function ExploreProduct({
  item,
  saved,
  busy,
  error,
  onBack,
  onShop,
  onSave,
  onTryOn,
  children,
}: {
  item: ExploreOutfit;
  saved: boolean;
  busy: boolean;
  error?: string;
  onBack: () => void;
  onShop?: () => void;
  onSave: () => void;
  onTryOn?: () => void;
  children?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion(true);
  const [broken, setBroken] = useState(false);
  const pop = useRef(new Animated.Value(0.6)).current;
  const twinkle = useRef(new Animated.Value(1)).current;
  const details = productDetails(item.tags, item.style);
  const price = productPrice(item.price_label);
  const store = item.brand || "Sample look";
  const rows = [
    {
      label: "Fabric",
      value: details.fabric,
      icon: "layers" as IconName,
      fill: "#FFF1B8",
    },
    {
      label: "Cut",
      value: details.cut,
      icon: "shirt" as IconName,
      fill: "#FFE1F1",
    },
    {
      label: "Style",
      value: details.style,
      icon: "sparkles" as IconName,
      fill: "#DCD5FF",
    },
  ].filter((row) => row.value);

  useEffect(() => {
    setBroken(false);
  }, [item.id, item.photo_url]);
  useEffect(() => {
    if (reduce) {
      pop.setValue(1);
      twinkle.setValue(1);
      return;
    }
    pop.setValue(0.6);
    const enter = Animated.sequence([
      Animated.timing(pop, {
        toValue: 1.08,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(pop, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, {
          toValue: 0.7,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(twinkle, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    enter.start();
    loop.start();
    return () => {
      enter.stop();
      loop.stop();
    };
  }, [reduce, pop, twinkle, item.id]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}
      >
        <View style={{ height: 486 + insets.top, ...shadow(0.12) }}>
          <View
            style={{
              flex: 1,
              borderBottomLeftRadius: 36,
              borderBottomRightRadius: 36,
              overflow: "hidden",
              backgroundColor: "#F1EEE4",
            }}
          >
            {broken ? (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                accessibilityLabel="Product photo unavailable"
              >
                <Icon name="hanger" size={64} color={colors.text3} />
              </View>
            ) : item.photo_url ? (
              <Image
                source={{ uri: sized(item.photo_url, 1200) }}
                contentFit="cover"
                contentPosition={{ left: "50%", top: "30%" }}
                accessibilityLabel={item.name + ", store photo"}
                onError={() => setBroken(true)}
                style={{ width: "100%", height: "100%" }}
              />
            ) : (
              <Figure image={item.image} scale={1.12} />
            )}
            <LinearGradient
              {...decorative}
              colors={[
                "rgba(20,18,31,0.28)",
                "rgba(20,18,31,0)",
                "rgba(20,18,31,0)",
                "rgba(20,18,31,0.35)",
              ]}
              locations={[0, 0.26, 0.7, 1]}
              style={{ position: "absolute", inset: 0 }}
            />
            <BackButton top={22 + insets.top} onPress={onBack} />
            <View
              style={{
                position: "absolute",
                top: 26 + insets.top,
                right: 20,
                maxWidth: "67%",
                minHeight: 36,
                borderRadius: 999,
                paddingHorizontal: 14,
                justifyContent: "center",
                backgroundColor: colors.ink,
              }}
            >
              <Text
                style={{
                  color: colors.white,
                  fontFamily: fonts.bold,
                  fontSize: 13,
                }}
              >
                {store}
              </Text>
            </View>
            {!!item.photo_url && (
              <View
                style={{
                  position: "absolute",
                  left: 18,
                  bottom: 18,
                  paddingHorizontal: 13,
                  height: 28,
                  borderRadius: 999,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 7,
                  backgroundColor: "rgba(255,255,255,0.92)",
                }}
              >
                <Icon name="image" size={14} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 12 }}>
                  Store photo
                </Text>
              </View>
            )}
          </View>
          {!!details.style && (
            <Animated.View
              {...decorative}
              style={{
                position: "absolute",
                right: 22,
                bottom: -1,
                paddingHorizontal: 14,
                paddingVertical: 7,
                backgroundColor: colors.pink,
                borderWidth: 3,
                borderColor: colors.white,
                borderRadius: 14,
                transform: [{ rotate: "8deg" }, { scale: pop }],
                ...shadow(0.12),
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.heading,
                  fontSize: 22,
                  lineHeight: 22,
                  color: colors.ink,
                }}
              >
                {details.style}
              </Text>
            </Animated.View>
          )}
        </View>
        <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
          <Text
            style={{
              fontFamily: fonts.bold,
              fontSize: 12,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              color: colors.text3,
            }}
          >
            {[item.brand, item.category].filter(Boolean).join(" · ")}
          </Text>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: fonts.heading,
              fontSize: 27,
              lineHeight: 28.62,
              letterSpacing: -0.9,
              color: colors.ink,
              marginTop: 8,
            }}
          >
            {item.name}
          </Text>
          {(price || details.color) && (
            <View
              style={{
                marginTop: 16,
                flexDirection: "row",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              {price && (
                <View
                  style={{
                    paddingHorizontal: 12,
                    paddingTop: 2,
                    paddingBottom: 4,
                    borderWidth: 2.5,
                    borderColor: colors.ink,
                    borderRadius: 12,
                    backgroundColor: colors.yellow,
                    transform: [{ rotate: "-3deg" }],
                    ...hardShadow(false, 3),
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.heading,
                      fontSize: 22,
                      lineHeight: 24,
                      letterSpacing: -0.4,
                      color: colors.ink,
                    }}
                  >
                    {price.sticker}
                  </Text>
                </View>
              )}
              {details.color && (
                <View
                  style={{
                    minHeight: 34,
                    paddingHorizontal: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 7,
                    borderWidth: 1.5,
                    borderColor: "#E6E1D2",
                    borderRadius: 999,
                    backgroundColor: colors.white,
                  }}
                >
                  {productSwatch[details.color.toLowerCase()] && (
                    <View
                      {...decorative}
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor:
                          productSwatch[details.color.toLowerCase()],
                        borderWidth: 0.5,
                        borderColor: "#14121F33",
                      }}
                    />
                  )}
                  <Text
                    style={{
                      fontFamily: fonts.bold,
                      fontSize: 13,
                      color: colors.ink,
                    }}
                  >
                    {details.color}
                  </Text>
                </View>
              )}
            </View>
          )}
          {onShop && (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Shop at ${store}, opens their store`}
              onPress={onShop}
              style={{
                marginTop: 22,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 14,
                minHeight: 74,
                borderRadius: 24,
                backgroundColor: colors.white,
                ...shadow(0.08),
              }}
            >
              <View
                style={{
                  height: 46,
                  width: 46,
                  borderRadius: 16,
                  backgroundColor: "#D7F6E3",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="shopping-bag" size={22} color="#127A55" />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text
                  style={{
                    fontFamily: fonts.bold,
                    fontSize: 16,
                    color: colors.ink,
                  }}
                >
                  Shop at {store}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 13,
                    color: colors.text3,
                  }}
                >
                  {price
                    ? price.store + " · opens their store"
                    : "Opens their store"}
                </Text>
              </View>
              <View
                style={{
                  height: 44,
                  width: 44,
                  borderRadius: 22,
                  backgroundColor: colors.ink,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View style={{ transform: [{ rotate: "-45deg" }] }}>
                  <Icon name="arrow-right" size={22} color={colors.yellow} />
                </View>
              </View>
            </Pressable>
          )}
          {!!rows.length && (
            <View style={{ marginTop: 24, gap: 12 }}>
              <Text
                accessibilityRole="header"
                style={{
                  fontFamily: fonts.heading,
                  fontSize: 20,
                  color: colors.ink,
                }}
              >
                The details
              </Text>
              <View
                style={{
                  borderRadius: 22,
                  overflow: "hidden",
                  backgroundColor: colors.white,
                }}
              >
                {rows.map((row, index) => (
                  <View
                    key={row.label}
                    style={{
                      minHeight: 52,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderTopWidth: index ? 1 : 0,
                      borderColor: "#F1EEE4",
                    }}
                  >
                    <View
                      style={{
                        height: 30,
                        width: 30,
                        borderRadius: 10,
                        backgroundColor: row.fill,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon name={row.icon} size={17} />
                    </View>
                    <Text
                      style={{
                        width: 76,
                        fontFamily: fonts.body,
                        fontSize: 14,
                        color: colors.text3,
                      }}
                    >
                      {row.label}
                    </Text>
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: fonts.bold,
                        fontSize: 14,
                        color: colors.ink,
                      }}
                    >
                      {row.value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {children}
          <Text
            style={{
              marginTop: 18,
              textAlign: "center",
              fontFamily: fonts.body,
              fontSize: 12,
              lineHeight: 18,
              color: colors.placeholder,
            }}
          >
            {item.photo_url
              ? `Photo from ${store} · Not affiliated · Price may change`
              : "Sample inspiration · no retailer, price or AI result is implied"}
          </Text>
          {!!error && (
            <Text
              style={{
                marginTop: 14,
                fontFamily: fonts.body,
                fontSize: 15,
                color: colors.ink,
              }}
              accessibilityRole="alert"
            >
              {error}
            </Text>
          )}
        </View>
      </ScrollView>
      <LinearGradient
        colors={["rgba(255,251,234,0)", colors.cream, colors.cream]}
        locations={[0, 0.02, 1]}
        pointerEvents="box-none"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingTop: 32,
          paddingHorizontal: 20,
          paddingBottom: 30 + insets.bottom,
        }}
      >
        <View style={{ flexDirection: "row", gap: 12 }}>
          <ProductAction
            label={saved ? "Saved" : "Save to your inspiration"}
            disabled={busy}
            onPress={onSave}
            reduce={reduce}
            style={{ width: 62 }}
            fill={colors.white}
          >
            {busy ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <Icon
                name={saved ? "heart-filled" : "heart"}
                size={26}
                color={saved ? "#FF6FB5" : colors.ink}
              />
            )}
          </ProductAction>
          {onTryOn && (
            <ProductAction
              label="Try this on"
              disabled={busy}
              onPress={onTryOn}
              reduce={reduce}
              style={{ flex: 1 }}
            >
              <Animated.View
                {...decorative}
                style={{
                  transform: [
                    { scale: twinkle },
                    {
                      rotate: twinkle.interpolate({
                        inputRange: [0.7, 1],
                        outputRange: ["25deg", "0deg"],
                      }),
                    },
                  ],
                  opacity: twinkle,
                }}
              >
                <MaterialCommunityIcons
                  name="star-four-points"
                  size={23}
                  color={colors.ink}
                />
              </Animated.View>
              <Text
                style={{
                  fontFamily: fonts.heading,
                  fontSize: 20,
                  letterSpacing: -0.3,
                  color: colors.ink,
                }}
              >
                {busy ? "Please wait…" : "Try this on"}
              </Text>
            </ProductAction>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

function ProductAction({
  label,
  disabled,
  onPress,
  children,
  style,
  fill = colors.yellow,
  reduce,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  children: React.ReactNode;
  style: ViewStyle;
  fill?: string;
  reduce: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        style,
        {
          minHeight: 62,
          borderWidth: 2.5,
          borderColor: colors.ink,
          borderRadius: 22,
          backgroundColor: fill,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 10,
          opacity: disabled ? 0.6 : 1,
          transform: [{ translateY: pressed && !reduce ? 2 : 0 }],
          ...hardShadow(pressed && !reduce),
        },
      ]}
    >
      {children}
    </Pressable>
  );
}
