import React from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { art } from "../data";
import { colors, fonts, gradients, shadow } from "../theme";
import { Heading, Icon } from "./ui";
import { Avatar } from "./Avatar";
import type { BattleView, Side } from "../lib/battles";

const TINTS = [
  gradients.lavender,
  gradients.mint,
  gradients.coral,
  gradients.yellow,
];

// 2 looks side by side, 3-4 in a grid. Results show once `results` is true.
export function BattleCards({
  battle,
  choice,
  onSelect,
  results,
}: {
  battle: BattleView;
  choice?: Side | null;
  onSelect?: (side: Side) => void;
  results?: boolean;
}) {
  const narrow = useWindowDimensions().width < 360;
  const options = battle.options;
  const pair = options.length === 2;
  const total = options.reduce((n, o) => n + battle.counts[o.side], 0);
  const top = Math.max(...options.map((o) => battle.counts[o.side]));
  const height = pair ? (narrow ? 270 : 320) : narrow ? 210 : 240;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {options.map((option, i) => {
        const count = battle.counts[option.side];
        const share = total ? Math.round((count / total) * 100) : 0;
        const picked = choice === option.side;
        const player =
          battle.kind === "versus"
            ? i === 0
              ? battle.players?.a
              : battle.players?.b
            : null;
        return (
          <Pressable
            key={option.side}
            accessibilityRole="button"
            accessibilityLabel={`Pick look ${option.side}`}
            accessibilityState={{ selected: picked, disabled: !onSelect }}
            disabled={!onSelect}
            onPress={() => onSelect?.(option.side)}
            style={{
              width: "48%",
              flexGrow: 1,
              height,
              borderRadius: 26,
              ...shadow(0.1),
            }}
          >
            <LinearGradient
              colors={TINTS[i]!}
              style={{
                flex: 1,
                borderRadius: 26,
                borderWidth: 4,
                borderColor: picked ? colors.ink : colors.white,
                overflow: "hidden",
              }}
            >
              {(option.url || option.sample) && (
                <Image
                  source={
                    option.url ? { uri: option.url } : art[option.sample!]
                  }
                  cachePolicy="none"
                  contentFit="cover"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  }}
                  accessibilityLabel={`Look ${option.side}`}
                />
              )}
              <View
                style={{
                  position: "absolute",
                  top: 10,
                  left: 10,
                  minWidth: 32,
                  height: 32,
                  paddingHorizontal: 8,
                  borderRadius: 16,
                  backgroundColor: picked ? colors.ink : colors.white,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {picked ? (
                  <Icon name="check" size={16} color={colors.yellow} />
                ) : (
                  <Heading size={15}>{option.side}</Heading>
                )}
              </View>
              {results && total > 0 && count === top && (
                <View
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    backgroundColor: colors.yellow,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 14,
                  }}
                >
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12 }}>
                    👑 Leading
                  </Text>
                </View>
              )}
              {(player || results) && (
                <View
                  style={{
                    position: "absolute",
                    left: 8,
                    right: 8,
                    bottom: 8,
                    padding: 10,
                    borderRadius: 18,
                    backgroundColor: "rgba(255,255,255,0.94)",
                    gap: 6,
                  }}
                >
                  {player !== null && player !== undefined && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Avatar
                        uri={player.avatar}
                        name={player.name ?? undefined}
                        size={24}
                      />
                      <Text
                        numberOfLines={1}
                        style={{
                          flex: 1,
                          fontFamily: fonts.bold,
                          fontSize: 13,
                        }}
                      >
                        {player.name ?? (i === 0 ? "Challenger" : "Friend")}
                      </Text>
                    </View>
                  )}
                  {results && (
                    <>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                        }}
                      >
                        <Heading size={18}>{share}%</Heading>
                        <Text
                          style={{
                            fontFamily: fonts.medium,
                            fontSize: 12,
                            color: colors.text3,
                            alignSelf: "center",
                          }}
                        >
                          {count} {count === 1 ? "vote" : "votes"}
                        </Text>
                      </View>
                      <View
                        style={{
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: colors.inactive,
                          overflow: "hidden",
                        }}
                      >
                        <View
                          style={{
                            width: `${share}%`,
                            height: "100%",
                            backgroundColor: colors.ink,
                          }}
                        />
                      </View>
                    </>
                  )}
                </View>
              )}
            </LinearGradient>
          </Pressable>
        );
      })}
      {pair && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: "50%",
            marginLeft: -24,
            top: height / 2 - 24,
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor:
              battle.kind === "versus" ? colors.pink : colors.yellow,
            borderWidth: 3,
            borderColor: colors.white,
            alignItems: "center",
            justifyContent: "center",
            ...shadow(0.2),
          }}
        >
          <Heading size={16}>{battle.kind === "versus" ? "VS" : "OR"}</Heading>
        </View>
      )}
    </View>
  );
}
