import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { Icon, StickerBadge, type IconName } from "./ui";
import { colors, fonts, shadow } from "../theme";

// The demo look in the viewfinder. Positions are for a 350pt-wide card and
// scale with it. ponytail: one sample; rotate several by making this a list.
const LOOK = {
  image: require("../../assets/examples/scan-hero.jpg"),
  alt: "Example scan: a person in a black zip-up hoodie, white tee and light baggy jeans",
  focal: { x: 0.5, y: 0.15 },
  hotspot: { x: 232, y: 197 },
  item: "Black zip hoodie",
};

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduce,
    );
    return () => sub.remove();
  }, []);
  return reduce;
}

function Bracket({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) {
  const top = corner[0] === "t",
    left = corner[1] === "l";
  return (
    <View
      style={{
        position: "absolute",
        width: 34,
        height: 34,
        borderColor: colors.yellow,
        [top ? "top" : "bottom"]: 28,
        [left ? "left" : "right"]: 28,
        [top ? "borderTopWidth" : "borderBottomWidth"]: 4,
        [left ? "borderLeftWidth" : "borderRightWidth"]: 4,
        [`border${top ? "Top" : "Bottom"}${left ? "Left" : "Right"}Radius`]: 12,
      }}
    />
  );
}

// Decorative "what a scan looks like" loop: not a live camera.
export function ScanViewfinderHero() {
  const width = useWindowDimensions().width - 40;
  const height = Math.round((width * 340) / 350);
  const k = width / 350;
  const reduce = useReduceMotion();
  const line = useRef(new Animated.Value(0.5)).current;
  const ping = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;

  // Runs only while the tab is focused and Reduce Motion is off.
  useFocusEffect(
    useCallback(() => {
      if (reduce) {
        line.setValue(0.5);
        blink.setValue(1);
        return;
      }
      const ease = Easing.inOut(Easing.ease);
      const loops = [
        Animated.loop(
          Animated.sequence([
            Animated.timing(line, {
              toValue: 1,
              duration: 2600,
              easing: ease,
              useNativeDriver: true,
            }),
            Animated.timing(line, {
              toValue: 0,
              duration: 2600,
              easing: ease,
              useNativeDriver: true,
            }),
          ]),
        ),
        Animated.loop(
          Animated.timing(ping, {
            toValue: 1,
            duration: 1600,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(blink, {
              toValue: 0.25,
              duration: 600,
              easing: ease,
              useNativeDriver: true,
            }),
            Animated.timing(blink, {
              toValue: 1,
              duration: 600,
              easing: ease,
              useNativeDriver: true,
            }),
          ]),
        ),
      ];
      loops.forEach((loop) => loop.start());
      return () => loops.forEach((loop) => loop.stop());
    }, [reduce, line, ping, blink]),
  );

  return (
    <View
      style={{
        width,
        height,
        alignSelf: "center",
        borderRadius: 32,
        backgroundColor: colors.ink,
        padding: 12,
        ...shadow(0.28),
      }}
    >
      <View style={{ flex: 1, borderRadius: 22, overflow: "hidden" }}>
        <Image
          source={LOOK.image}
          accessible
          accessibilityLabel={LOOK.alt}
          contentFit="cover"
          contentPosition={{
            left: `${LOOK.focal.x * 100}%`,
            top: `${LOOK.focal.y * 100}%`,
          }}
          style={{ flex: 1 }}
        />
        <LinearGradient
          pointerEvents="none"
          colors={[
            "rgba(20,18,31,0.4)",
            "rgba(20,18,31,0)",
            "rgba(20,18,31,0)",
            "rgba(20,18,31,0.4)",
          ]}
          locations={[0, 0.3, 0.68, 1]}
          style={{ position: "absolute", inset: 0 } as ViewStyle}
        />
      </View>
      <View
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={{ position: "absolute", inset: 0 } as ViewStyle}
      >
        {(["tl", "tr", "bl", "br"] as const).map((c) => (
          <Bracket key={c} corner={c} />
        ))}
        <Animated.View
          style={{
            position: "absolute",
            left: 34,
            right: 34,
            top: 0,
            height: 3,
            borderRadius: 2,
            backgroundColor: colors.yellow,
            shadowColor: colors.yellow,
            shadowOpacity: 0.55,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 0 },
            transform: [
              {
                translateY: line.interpolate({
                  inputRange: [0, 1],
                  outputRange: [44 * k, 286 * k],
                }),
              },
            ],
          }}
        />
        {!reduce && (
          <Animated.View
            style={{
              position: "absolute",
              left: LOOK.hotspot.x * k - 7,
              top: LOOK.hotspot.y * k - 7,
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: colors.yellow,
              opacity: ping.interpolate({
                inputRange: [0, 1],
                outputRange: [0.75, 0],
              }),
              transform: [
                {
                  scale: ping.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 2.8],
                  }),
                },
              ],
            }}
          />
        )}
        <View
          style={{
            position: "absolute",
            left: LOOK.hotspot.x * k - 7,
            top: LOOK.hotspot.y * k - 7,
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: colors.yellow,
            borderWidth: 3,
            borderColor: colors.ink,
          }}
        />
      </View>
      {/* Readable labels stay visible to screen readers via the image alt. */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: "absolute", inset: 0 } as ViewStyle}
      >
        <View
          style={{
            position: "absolute",
            top: 30,
            alignSelf: "center",
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: "rgba(255,255,255,0.95)",
            borderRadius: 999,
            paddingVertical: 5,
            paddingHorizontal: 12,
          }}
        >
          <Animated.View
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: "#FF5A47",
              opacity: blink,
            }}
          />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12 }}>
            Scanning
          </Text>
        </View>
        <StickerBadge
          rotate="-7deg"
          size={14}
          style={{ position: "absolute", left: 18, top: 96 * k }}
        >
          Ooh, that one
        </StickerBadge>
        <View
          style={{
            position: "absolute",
            right: 16,
            top: 222 * k,
            backgroundColor: colors.white,
            borderWidth: 3,
            borderColor: colors.white,
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 6,
            transform: [{ rotate: "5deg" }],
            ...shadow(0.22),
          }}
        >
          <Text style={{ fontFamily: fonts.heading, fontSize: 16 }}>
            {LOOK.item}
          </Text>
          <Text
            style={{ fontFamily: fonts.bold, fontSize: 11, color: "#127A55" }}
          >
            Found it
          </Text>
        </View>
      </View>
    </View>
  );
}

// "Pressed key" button: a hard ink shadow that the face sinks into.
export function TactileButton({
  icon,
  title,
  label,
  fill = colors.yellow,
  onPress,
  style,
}: {
  icon: IconName;
  title?: string;
  label?: string;
  fill?: string;
  onPress: () => void;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        { height: 64, borderRadius: 22, backgroundColor: colors.ink },
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ?? title}
        onPressIn={() =>
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          )
        }
        onPress={onPress}
        style={({ pressed }) => ({
          height: 60,
          marginTop: pressed ? 4 : 0,
          borderRadius: 22,
          borderWidth: 2.5,
          borderColor: colors.ink,
          backgroundColor: fill,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        })}
      >
        <Icon name={icon} size={title ? 22 : 24} />
        {!!title && (
          <Text style={{ fontFamily: fonts.bold, fontSize: 17 }}>{title}</Text>
        )}
      </Pressable>
    </View>
  );
}

export function HowScanWorks() {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {[
        ["Snap it", "Any piece, anywhere"],
        ["We find it", "Exact match or cheaper"],
        ["Try it on", "See it on you first"],
      ].map(([title, caption], i) => (
        <View
          key={title}
          style={{
            flex: 1,
            backgroundColor: colors.white,
            borderRadius: 20,
            padding: 12,
            gap: 6,
            ...shadow(0.06),
          }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: colors.ink,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontFamily: fonts.bold,
                fontSize: 12,
                color: colors.yellow,
              }}
            >
              {i + 1}
            </Text>
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14 }}>{title}</Text>
          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: 12,
              color: colors.text2,
            }}
          >
            {caption}
          </Text>
        </View>
      ))}
    </View>
  );
}
