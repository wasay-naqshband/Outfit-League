import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Heading, Icon } from "./ui";
import { colors, gradients } from "../theme";

const STEP = 3500;

// Wait screen: pulsing, spinning sparkle, rotating messages and a progress bar
// that eases toward 92% over `seconds` (it never claims to be done early).
// `startedAt` lets a second screen pick up where the first one left off.
export function CookingLoader({
  messages,
  seconds,
  startedAt,
  fullScreen,
  onClose,
  height = 359,
}: {
  messages: string[];
  seconds: number;
  startedAt?: number;
  fullScreen?: boolean;
  onClose?: () => void;
  height?: number;
}) {
  const start = useRef(startedAt ?? Date.now()).current;
  const at = () => Math.floor((Date.now() - start) / STEP) % messages.length;
  const [index, setIndex] = useState(at);
  const insets = useSafeAreaInsets();
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loops = [
      Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 2400,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 700,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
    ];
    loops.forEach((loop) => loop.start());
    const done = Math.min(1, (Date.now() - start) / (seconds * 1000));
    progress.setValue(0.92 * (1 - (1 - done) ** 3));
    Animated.timing(progress, {
      toValue: 0.92,
      duration: Math.max(1, (1 - done) * seconds * 1000),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    // Messages loop for as long as the wait lasts.
    const timer = setInterval(() => {
      // Swap first, then fade in: the text never waits on an animation.
      setIndex(at());
      fade.setValue(0);
      Animated.timing(fade, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
    }, STEP);
    return () => {
      clearInterval(timer);
      loops.forEach((loop) => loop.stop());
    };
  }, [messages.length, seconds]);

  return (
    <LinearGradient
      colors={gradients.lavender}
      style={[
        {
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          padding: 24,
        },
        fullScreen
          ? { flex: 1 }
          : {
              height,
              borderRadius: 32,
              borderWidth: 4,
              borderColor: colors.white,
            },
      ]}
    >
      {onClose && (
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{
            position: "absolute",
            left: 20,
            top: insets.top + 12,
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.white,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="x" size={20} />
        </Pressable>
      )}
      <Animated.View
        style={{
          width: fullScreen ? 128 : 96,
          height: fullScreen ? 128 : 96,
          borderRadius: 64,
          backgroundColor: colors.yellow,
          alignItems: "center",
          justifyContent: "center",
          transform: [
            {
              scale: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.92, 1.08],
              }),
            },
            {
              rotate: spin.interpolate({
                inputRange: [0, 1],
                outputRange: ["0deg", "360deg"],
              }),
            },
          ],
        }}
      >
        <Icon name="sparkles" size={fullScreen ? 64 : 48} />
      </Animated.View>
      <Animated.View style={{ opacity: fade, minHeight: 72 }}>
        <Heading size={fullScreen ? 30 : 24} style={{ textAlign: "center" }}>
          {messages[index]}
        </Heading>
      </Animated.View>
      <View
        style={{
          width: "80%",
          height: 10,
          borderRadius: 5,
          backgroundColor: colors.white,
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={{
            height: "100%",
            borderRadius: 5,
            backgroundColor: colors.ink,
            width: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"],
            }),
          }}
        />
      </View>
    </LinearGradient>
  );
}

export const TRYON_MESSAGES = [
  "We’re cooking your fit… 🔥",
  "The wait will be worth it ✨",
  "Matching the fabric to you…",
  "Tailoring the fit…",
  "Just a little bit more…",
  "Getting the lighting right…",
  "Adding the final touches…",
  "Trust us — it’s worth the wait 👀",
];
export const SPIN_MESSAGES = [
  "Setting up the turntable… 🎬",
  "The wait will be worth it ✨",
  "Spinning you around…",
  "Checking your good side…",
  "Rendering the back view…",
  "Just a little bit more…",
  "Smoothing every angle…",
  "Polishing the final frames…",
];
