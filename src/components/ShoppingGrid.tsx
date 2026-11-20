import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { Body, Button, Icon } from "./ui";
import { money } from "./Lookalikes";
import { useReduceMotion } from "./ScanHero";
import type { Lookalike } from "../lib/tryon-api";
import { colors, fonts, shadow } from "../theme";

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
