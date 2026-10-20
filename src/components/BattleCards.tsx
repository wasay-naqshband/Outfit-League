import React from "react";
import { Pressable, View, Text, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { art } from "../data";
import { colors, fonts, gradients, shadow } from "../theme";
import { Heading, StickerBadge } from "./ui";
import type { BattleView } from "../lib/battles";
export function BattleCards({
  battle,
  choice,
  onSelect,
}: {
  battle: BattleView;
  choice?: "A" | "B" | null;
  onSelect?: (side: "A" | "B") => void;
}) {
  const compact = useWindowDimensions().width < 360,
    total = battle.counts.A + battle.counts.B;
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      {(["A", "B"] as const).map((side) => {
        const url = side === "A" ? battle.aUrl : battle.bUrl,
          sample = side === "A" ? battle.aSample : battle.bSample,
          label = side === "A" ? battle.aLabel : battle.bLabel;
        return (
          <Pressable
            key={side}
            accessibilityRole="button"
            accessibilityLabel={`Choose Fit ${side}`}
            accessibilityState={{
              selected: choice === side,
              disabled: !onSelect,
            }}
            disabled={!onSelect}
            onPress={() => onSelect?.(side)}
            style={{ flex: 1, height: compact ? 260 : 300, ...shadow(0.12) }}
          >
            <LinearGradient
              colors={side === "A" ? gradients.lavender : gradients.mint}
              style={{
                flex: 1,
                borderRadius: 28,
                borderWidth: 4,
                borderColor: choice === side ? colors.ink : colors.white,
                overflow: "hidden",
              }}
            >
              {(url || sample) && (
                <Image
                  source={url ? { uri: url } : art[sample!]}
                  cachePolicy="none"
                  contentFit="contain"
                  style={{
                    position: "absolute",
                    top: 42,
                    bottom: 65,
                    left: 0,
                    right: 0,
                  }}
                  accessibilityLabel={`Fit ${side} · ${label}`}
                />
              )}
              <View
                style={{
                  position: "absolute",
                  top: 10,
                  left: 10,
                  backgroundColor: colors.white,
                  padding: 8,
                  borderRadius: 14,
                }}
              >
                <Heading size={15}>Fit {side}</Heading>
              </View>
              {choice === side && (
                <StickerBadge
                  style={{ position: "absolute", top: 45, right: 5 }}
                  rotate={side === "A" ? "-5deg" : "6deg"}
                >
                  Picked!
                </StickerBadge>
              )}
              <View
                style={{
                  position: "absolute",
                  bottom: 10,
                  left: 8,
                  right: 8,
                  padding: 10,
                  borderRadius: 16,
                  backgroundColor: choice === side ? colors.ink : colors.white,
                  gap: 3,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: fonts.bold,
                    fontSize: 13,
                    color: choice === side ? colors.white : colors.ink,
                  }}
                >
                  {label || "Preparing image…"}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.bold,
                    fontSize: 14,
                    color: choice === side ? colors.white : colors.ink,
                  }}
                >
                  {total
                    ? `${Math.round((battle.counts[side] / total) * 100)}% · ${battle.counts[side]} ${battle.counts[side] === 1 ? "vote" : "votes"}`
                    : "No votes yet"}
                </Text>
              </View>
            </LinearGradient>
          </Pressable>
        );
      })}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: "50%",
          marginLeft: -26,
          top: 110,
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: colors.pink,
          borderWidth: 3,
          borderColor: colors.white,
          alignItems: "center",
          justifyContent: "center",
          ...shadow(0.2),
        }}
      >
        <Heading size={18}>VS</Heading>
      </View>
    </View>
  );
}
