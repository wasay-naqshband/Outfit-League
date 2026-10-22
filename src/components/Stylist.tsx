import React from "react";
import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Body, Heading } from "./ui";
import type { Rating, Swatch } from "../lib/tryon-api";
import { colors, fonts, gradients } from "../theme";

export function Bullets({ items, mark }: { items: string[]; mark: string }) {
  return (
    <View style={{ gap: 6 }}>
      {items.map((item) => (
        <View key={item} style={{ flexDirection: "row", gap: 8 }}>
          <Text style={{ fontSize: 15 }}>{mark}</Text>
          <Body style={{ flex: 1, fontSize: 15, color: colors.ink }}>
            {item}
          </Body>
        </View>
      ))}
    </View>
  );
}

export function RatingCard({ rating }: { rating: Rating }) {
  return (
    <LinearGradient
      colors={gradients.yellow}
      style={{
        borderRadius: 28,
        borderWidth: 4,
        borderColor: colors.white,
        padding: 20,
        gap: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <View
          style={{
            width: 76,
            height: 76,
            borderRadius: 38,
            backgroundColor: colors.ink,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontFamily: fonts.bold,
              fontSize: 30,
              color: colors.yellow,
            }}
          >
            {rating.score}
          </Text>
          <Text
            style={{
              fontFamily: fonts.medium,
              fontSize: 11,
              color: colors.white,
            }}
          >
            out of 10
          </Text>
        </View>
        <Heading size={20} style={{ flex: 1 }}>
          {rating.headline}
        </Heading>
      </View>
      {!!rating.good.length && <Bullets items={rating.good} mark="✓" />}
      {!!rating.tips.length && (
        <>
          <Heading size={17}>Level it up</Heading>
          <Bullets items={rating.tips} mark="💡" />
        </>
      )}
    </LinearGradient>
  );
}

export function Swatches({ title, items }: { title: string; items: Swatch[] }) {
  if (!items.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <Heading size={16}>{title}</Heading>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {items.map((swatch) => (
          <View
            key={swatch.name + swatch.hex}
            style={{ width: 64, alignItems: "center", gap: 4 }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: swatch.hex,
                borderWidth: 3,
                borderColor: colors.white,
              }}
            />
            <Text
              numberOfLines={2}
              style={{
                fontFamily: fonts.medium,
                fontSize: 11,
                textAlign: "center",
                color: colors.ink,
              }}
            >
              {swatch.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
