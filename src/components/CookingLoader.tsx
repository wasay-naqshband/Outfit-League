import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Body, Heading, Icon } from "./ui";
import { colors, gradients } from "../theme";

// Wait screen: pulsing, spinning sparkle, rotating messages and a progress bar
// that eases toward 92% over `seconds` (it never claims to be done early).
export function CookingLoader({
  messages,
  seconds,
  height = 359,
}: {
  messages: string[];
  seconds: number;
  height?: number;
}) {
  const [index, setIndex] = useState(0);
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
    Animated.timing(progress, {
      toValue: 0.92,
      duration: seconds * 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    // Messages spread across the expected wait and stop on the last one.
    const timer = setInterval(
      () => {
        // Swap first, then fade in: the text never waits on an animation.
        setIndex((i) => Math.min(i + 1, messages.length - 1));
        fade.setValue(0);
        Animated.timing(fade, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }).start();
      },
      Math.max(3000, (seconds * 1000) / messages.length),
    );
    return () => {
      clearInterval(timer);
      loops.forEach((loop) => loop.stop());
    };
  }, [messages.length, seconds]);

  return (
    <LinearGradient
      colors={gradients.lavender}
      style={{
        height,
        borderRadius: 32,
        borderWidth: 4,
        borderColor: colors.white,
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
        padding: 24,
      }}
    >
      <Animated.View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
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
        <Icon name="sparkles" size={48} />
      </Animated.View>
      <Animated.View style={{ opacity: fade, alignItems: "center", gap: 6 }}>
        <Heading size={24} style={{ textAlign: "center" }}>
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
      <Body style={{ fontSize: 13, textAlign: "center" }}>
        You can leave this screen — we’ll keep cooking.
      </Body>
    </LinearGradient>
  );
}

export const TRYON_MESSAGES = [
  "We’re cooking your fit… 🔥",
  "Matching the fabric to you…",
  "Tailoring the fit…",
  "Getting the lighting right…",
  "Just a little bit more…",
  "Adding the final touches…",
  "Almost there — worth the wait ✨",
];
export const SPIN_MESSAGES = [
  "Setting up the turntable… 🎬",
  "Spinning you around…",
  "Checking your good side…",
  "Rendering the back view…",
  "Smoothing every angle…",
  "Just a little bit more…",
  "Polishing the final frames…",
  "Almost there — worth the wait ✨",
];
