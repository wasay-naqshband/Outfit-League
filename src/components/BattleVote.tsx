import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Icon } from "./ui";
import { Avatar } from "./Avatar";
import { useReduceMotion } from "./ScanHero";
import { art } from "../data";
import { colors, fonts } from "../theme";
import type { BattleView, Side } from "../lib/battles";

// Public vote page pieces (the shared "Help me choose" link).
export const SIDE_COLOR: Record<string, string> = {
  A: colors.pink,
  B: "#9FD0FF",
  C: "#BDF0D2",
  D: "#DCD4FD",
};
const PASTELS = ["#FFE1F1", "#E4F1FF", "#D7F6E3", "#FFF1B8", "#EEEAFF"];
const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants" as const,
};
export const hard = (y = 4): ViewStyle => ({
  shadowColor: colors.ink,
  shadowOpacity: 1,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: y },
  elevation: 2,
});
const soft = (o = 0.08): ViewStyle => ({
  shadowColor: colors.ink,
  shadowOpacity: o,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 12 },
  elevation: 3,
});

// Endless gentle loop; stops (and sits at rest) with Reduce Motion.
function useLoop(ms: number, reduce: boolean) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return v.setValue(0);
    const loop = Animated.loop(
      Animated.timing(v, {
        toValue: 1,
        duration: ms,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: Platform.OS !== "web",
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [ms, reduce, v]);
  return v;
}

export function VoteHeader({
  battle,
  total,
  back,
}: {
  battle: BattleView;
  total: number;
  back?: () => void;
}) {
  const reduce = useReduceMotion();
  const pulse = useLoop(1800, reduce);
  const live = battle.status === "published";
  const creator = battle.kind === "versus" ? battle.players?.a : null;
  const face = battle.options[0];
  const words = battle.title.trim().split(/\s+/);
  const long = battle.title.length > 40 || words.length < 2;
  const last = words.pop();
  return (
    <LinearGradient
      colors={["#FFF48A", "#FFE93B", "#FFDD1F"]}
      style={{
        borderBottomLeftRadius: 34,
        borderBottomRightRadius: 34,
        paddingTop: 22,
        paddingHorizontal: 20,
        paddingBottom: 26,
        overflow: "hidden",
      }}
    >
      <View
        {...hidden}
        style={{
          position: "absolute",
          right: -70,
          bottom: -90,
          width: 230,
          height: 230,
          borderRadius: 115,
          backgroundColor: "rgba(255,255,255,0.28)",
        }}
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <Pressable
          accessibilityRole={back ? "button" : "link"}
          accessibilityLabel={back ? "Back" : "Outfit League"}
          onPress={back ?? (() => router.push("/welcome"))}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            minHeight: 44,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              borderWidth: 2.5,
              borderColor: colors.ink,
              backgroundColor: colors.yellow,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name={back ? "arrow-left" : "hanger"} size={17} />
          </View>
          <Text style={{ fontFamily: fonts.heading, fontSize: 17 }}>
            Outfit League
          </Text>
        </Pressable>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: colors.ink,
            borderRadius: 999,
            paddingHorizontal: 14,
            height: 34,
          }}
        >
          <Animated.View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: live ? "#5CE08F" : "#9A96A6",
              opacity: live
                ? pulse.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [1, 0.35, 1],
                  })
                : 1,
            }}
          />
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: "#FFF" }}>
            {live
              ? "Live"
              : battle.status === "closed"
                ? "Ended"
                : battle.status === "draft"
                  ? "Draft"
                  : "Not shared"}{" "}
            · {total} {total === 1 ? "vote" : "votes"}
          </Text>
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          marginTop: 22,
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            borderWidth: 2.5,
            borderColor: colors.white,
            overflow: "hidden",
            backgroundColor: colors.white,
          }}
        >
          {creator?.avatar || !(face?.url || face?.sample) ? (
            <Avatar
              uri={creator?.avatar}
              name={creator?.name ?? battle.title}
              size={29}
            />
          ) : (
            <Image
              source={face!.url ? { uri: face!.url } : art[face!.sample!]}
              contentFit="cover"
              contentPosition="top"
              cachePolicy="none"
              style={{ width: "100%", height: "100%" }}
            />
          )}
        </View>
        <Text
          style={{ fontFamily: fonts.bold, fontSize: 14, color: "#4A3F00" }}
        >
          {creator?.name
            ? `${creator.name} needs your vote`
            : "needs your vote"}
        </Text>
      </View>
      <Text
        accessibilityRole="header"
        style={{
          marginTop: 10,
          fontFamily: fonts.heading,
          fontSize: long ? 28 : 34,
          lineHeight: long ? 32 : 40,
          letterSpacing: -1.3,
          color: colors.ink,
        }}
      >
        {long ? battle.title : `${words.join(" ")} `}
        {!long && (
          <View
            style={{
              backgroundColor: colors.pink,
              borderWidth: 3,
              borderColor: colors.white,
              borderRadius: 14,
              paddingHorizontal: 8,
              transform: [{ rotate: "-4deg" }, { translateY: 6 }],
            }}
          >
            <Text
              style={{
                fontFamily: fonts.heading,
                fontSize: 34,
                lineHeight: 40,
                letterSpacing: -1.3,
              }}
            >
              {last}
            </Text>
          </View>
        )}
      </Text>
    </LinearGradient>
  );
}

function MyPick({ reduce }: { reduce: boolean }) {
  const pop = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (!reduce)
      Animated.spring(pop, {
        toValue: 1,
        friction: 5,
        tension: 140,
        useNativeDriver: Platform.OS !== "web",
      }).start();
  }, [pop, reduce]);
  return (
    <Animated.View
      {...hidden}
      style={{
        position: "absolute",
        bottom: 14,
        right: 6,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: colors.yellow,
        borderWidth: 2.5,
        borderColor: colors.ink,
        borderRadius: 999,
        paddingVertical: 6,
        paddingLeft: 6,
        paddingRight: 12,
        ...hard(3),
        transform: [{ rotate: "8deg" }, { scale: pop }],
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: colors.ink,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="check" size={12} color={colors.yellow} />
      </View>
      <Text style={{ fontFamily: fonts.heading, fontSize: 15 }}>My pick</Text>
    </Animated.View>
  );
}

// Two tilted cards with letter stickers and a wobbling VS badge.
export function FitPicker({
  battle,
  choice,
  onSelect,
  hint,
}: {
  battle: BattleView;
  choice: Side | null;
  onSelect?: (side: Side) => void;
  hint?: string;
}) {
  const reduce = useReduceMotion();
  const wobble = useLoop(2400, reduce);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ height: 350, marginHorizontal: -2 }}>
        {battle.options.slice(0, 2).map((option, i) => {
          const picked = choice === option.side;
          const dim = !!choice && !picked;
          return (
            <Pressable
              key={option.side}
              accessibilityRole="button"
              accessibilityLabel={`Fit ${option.side}`}
              accessibilityState={{ selected: picked, disabled: !onSelect }}
              disabled={!onSelect}
              onPress={() => onSelect?.(option.side)}
              style={{
                position: "absolute",
                top: i ? 6 : 14,
                [i ? "right" : "left"]: 4,
                width: "47%",
                height: 300,
                transform: [{ rotate: i ? "3deg" : "-3deg" }],
              }}
            >
              <View
                style={{
                  flex: 1,
                  borderRadius: 28,
                  borderWidth: 5,
                  borderColor: picked ? colors.yellow : colors.white,
                  backgroundColor: colors.white,
                  overflow: "hidden",
                  ...(picked ? {} : soft(0.2)),
                }}
              >
                {(option.url || option.sample) && (
                  <Image
                    source={
                      option.url ? { uri: option.url } : art[option.sample!]
                    }
                    cachePolicy="none"
                    contentFit="cover"
                    accessibilityLabel={option.label || `Outfit ${option.side}`}
                    style={{ flex: 1 }}
                  />
                )}
                {dim && (
                  <View
                    pointerEvents="none"
                    style={
                      {
                        position: "absolute",
                        inset: 0,
                        backgroundColor: "rgba(255,251,234,0.3)",
                      } as ViewStyle
                    }
                  />
                )}
              </View>
              {picked && (
                // Ink ring + hard shadow round the yellow border.
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: -2.5,
                    left: -2.5,
                    right: -2.5,
                    bottom: -2.5,
                    borderRadius: 30,
                    borderWidth: 2.5,
                    borderColor: colors.ink,
                    zIndex: -1,
                    backgroundColor: colors.ink,
                    ...hard(6),
                  }}
                />
              )}
              <View
                {...hidden}
                style={{
                  position: "absolute",
                  top: -12,
                  [i ? "right" : "left"]: -10,
                  width: 46,
                  height: 46,
                  borderRadius: 16,
                  borderWidth: 3,
                  borderColor: colors.white,
                  backgroundColor: SIDE_COLOR[option.side],
                  alignItems: "center",
                  justifyContent: "center",
                  transform: [{ rotate: i ? "6deg" : "-6deg" }],
                }}
              >
                <Text style={{ fontFamily: fonts.heading, fontSize: 24 }}>
                  {option.side}
                </Text>
              </View>
              {picked && <MyPick reduce={reduce} />}
            </Pressable>
          );
        })}
        <Animated.View
          {...hidden}
          pointerEvents="none"
          style={{
            position: "absolute",
            left: "50%",
            top: 150,
            marginLeft: -29,
            width: 58,
            height: 58,
            borderRadius: 29,
            borderWidth: 4,
            borderColor: colors.cream,
            backgroundColor: colors.ink,
            alignItems: "center",
            justifyContent: "center",
            transform: [
              {
                rotate: wobble.interpolate({
                  inputRange: [0, 0.25, 0.75, 1],
                  outputRange: ["0deg", "-6deg", "6deg", "0deg"],
                }),
              },
            ],
          }}
        >
          <Text
            style={{
              fontFamily: fonts.heading,
              fontSize: 19,
              color: colors.yellow,
            }}
          >
            VS
          </Text>
        </Animated.View>
      </View>
      {!!hint && (
        <Text
          style={{
            textAlign: "center",
            fontFamily: fonts.medium,
            fontSize: 13,
            color: colors.text3,
          }}
        >
          {hint}
        </Text>
      )}
    </View>
  );
}

export function Switch({
  value,
  label,
  onChange,
}: {
  value: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: 44,
        paddingHorizontal: 4,
      }}
    >
      <Text style={{ fontFamily: fonts.medium, fontSize: 15 }}>{label}</Text>
      <View
        style={{
          width: 50,
          height: 30,
          borderRadius: 15,
          borderWidth: 2,
          borderColor: colors.ink,
          backgroundColor: value ? colors.ink : "#E6E1D2",
          justifyContent: "center",
          paddingHorizontal: 2,
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: value ? colors.yellow : colors.white,
            alignSelf: value ? "flex-end" : "flex-start",
          }}
        />
      </View>
    </Pressable>
  );
}

// A/B split bar from the real counts; 50/50 and "No votes yet" when empty.
export function ScoreBar({ battle }: { battle: BattleView }) {
  const reduce = useReduceMotion();
  const [a, b] = battle.options;
  const ca = battle.counts[a!.side],
    cb = battle.counts[b!.side];
  const total = ca + cb;
  const pa = total ? Math.round((ca / total) * 100) : 50;
  const width = useRef(new Animated.Value(pa)).current;
  useEffect(() => {
    if (reduce) return width.setValue(pa);
    Animated.timing(width, {
      toValue: pa,
      duration: 400,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [pa, reduce, width]);
  const label = (side: string, p: number) => (total ? `${side} · ${p}%` : "");
  return (
    <View
      accessibilityLabel={
        total
          ? `${a!.side} ${pa} percent, ${b!.side} ${100 - pa} percent`
          : "No votes yet"
      }
      style={{
        height: 40,
        borderRadius: 14,
        borderWidth: 2.5,
        borderColor: colors.ink,
        backgroundColor: "#E4F1FF",
        overflow: "hidden",
        flexDirection: "row",
        ...hard(3),
      }}
    >
      <Animated.View
        style={{
          minWidth: total && ca ? 66 : 0,
          maxWidth: total && cb ? "82%" : "100%",
          width: width.interpolate({
            inputRange: [0, 100],
            outputRange: ["0%", "100%"],
          }),
          backgroundColor: colors.pink,
          borderRightWidth: total && ca && cb ? 2.5 : 0,
          borderColor: colors.ink,
          justifyContent: "center",
          paddingHorizontal: 12,
        }}
      >
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.heading, fontSize: 15 }}
        >
          {ca ? label(a!.side, pa) : ""}
        </Text>
      </Animated.View>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: total ? "flex-end" : "center",
          paddingHorizontal: 12,
          marginLeft: total ? 0 : "-50%",
        }}
      >
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.heading, fontSize: 15 }}
        >
          {total ? (cb ? label(b!.side, 100 - pa) : "") : "No votes yet"}
        </Text>
      </View>
    </View>
  );
}

export function VoterChips({ voters }: { voters: BattleView["voters"] }) {
  const shown = voters.slice(0, 8);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {shown.map((voter, i) => (
        <View
          key={voter.id}
          accessibilityLabel={`${voter.display_name} picked ${voter.choice}`}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: colors.white,
            borderRadius: 999,
            padding: 4,
            paddingRight: 6,
            ...soft(0.06),
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: PASTELS[i % PASTELS.length],
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontFamily: fonts.heading, fontSize: 13 }}>
              {voter.display_name.trim()[0]?.toUpperCase()}
            </Text>
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14 }}>
            {voter.display_name}
          </Text>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 8,
              backgroundColor: SIDE_COLOR[voter.choice],
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontFamily: fonts.heading, fontSize: 13 }}>
              {voter.choice}
            </Text>
          </View>
        </View>
      ))}
      {voters.length > 8 && (
        <View
          style={{
            backgroundColor: colors.white,
            borderRadius: 999,
            paddingHorizontal: 14,
            justifyContent: "center",
            height: 36,
            ...soft(0.06),
          }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 14 }}>
            +{voters.length - 8}
          </Text>
        </View>
      )}
    </View>
  );
}

// Growth card for visitors on the web link. ponytail: landing page until the
// App Store listing is public; then link iOS to it with ct=vote_page.
export function GetTheApp({ battle }: { battle?: BattleView }) {
  if (Platform.OS !== "web") return null;
  const thumbs = (battle?.options ?? []).slice(0, 2);
  return (
    <View
      style={{
        backgroundColor: colors.ink,
        borderRadius: 28,
        paddingVertical: 18,
        paddingHorizontal: 16,
        gap: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View {...hidden} style={{ width: 58, height: 52 }}>
          {thumbs.map((option, i) => (
            <View
              key={option.side}
              style={{
                position: "absolute",
                left: i * 20,
                top: i * 4,
                width: 34,
                height: 44,
                borderRadius: 10,
                borderWidth: 2.5,
                borderColor: colors.white,
                overflow: "hidden",
                backgroundColor: SIDE_COLOR[option.side],
                transform: [{ rotate: i ? "8deg" : "-8deg" }],
              }}
            >
              {(option.url || option.sample) && (
                <Image
                  source={
                    option.url ? { uri: option.url } : art[option.sample!]
                  }
                  contentFit="cover"
                  cachePolicy="none"
                  style={{ flex: 1 }}
                />
              )}
            </View>
          ))}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{ fontFamily: fonts.heading, fontSize: 19, color: "#FFF" }}
          >
            Start your own battle
          </Text>
          <Text
            style={{ fontFamily: fonts.body, fontSize: 13, color: "#D9D6E3" }}
          >
            Try on fits with AI. Let friends pick.
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="link"
        onPress={() =>
          router.push({ pathname: "/welcome", params: { ct: "vote_page" } })
        }
        style={({ pressed }) => ({
          height: 52,
          borderRadius: 18,
          backgroundColor: colors.yellow,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ translateY: pressed ? 2 : 0 }],
        })}
      >
        <Text style={{ fontFamily: fonts.heading, fontSize: 17 }}>
          Get the app
        </Text>
      </Pressable>
    </View>
  );
}
