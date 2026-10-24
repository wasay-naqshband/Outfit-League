import React from "react";
import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Body, Heading } from "./ui";
import type { Rating } from "../lib/tryon-api";
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
