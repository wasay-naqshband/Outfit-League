import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { Body, Heading, Icon, type IconName } from "./ui";
import { colors, fonts, shadow } from "../theme";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => subscription.remove();
  }, []);
  return reduced;
}

export function StickerTag({
  children,
  backgroundColor = colors.pink,
  rotate = "-5deg",
  size = 18,
  style,
}: {
  children: React.ReactNode;
  backgroundColor?: string;
  rotate?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      accessible={false}
      style={[
        {
          backgroundColor,
          borderWidth: 3,
          borderColor: colors.white,
          borderRadius: 14,
          paddingHorizontal: 10,
          paddingVertical: 3,
          transform: [{ rotate: rotate as `${number}deg` }],
          ...shadow(0.2),
        },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: fonts.heading,
          fontSize: size,
          letterSpacing: -0.4,
          color: colors.ink,
          includeFontPadding: false,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

export function TactileButton({
  title,
  icon,
  onPress,
  disabled = false,
  secondary = false,
}: {
  title: string;
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
          () => {},
        );
        onPress();
      }}
      style={({ pressed }) => ({
        minHeight: 56,
        borderRadius: 22,
        borderWidth: 2.5,
        borderColor: disabled ? "#9A9590" : colors.ink,
        backgroundColor: disabled
          ? "#9A9590"
          : secondary
            ? colors.white
            : colors.yellow,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        paddingHorizontal: 16,
        transform: [{ translateY: pressed && !disabled ? 4 : 0 }],
        shadowColor: colors.ink,
        shadowOffset: { width: 0, height: pressed || disabled ? 0 : 4 },
        shadowOpacity: pressed || disabled ? 0 : 1,
        shadowRadius: 0,
        elevation: pressed || disabled ? 0 : 3,
        ...(pressed || disabled
          ? {}
          : { boxShadow: "0px 4px 0px #14121F" as never }),
        opacity: disabled ? 1 : pressed ? 0.92 : 1,
      })}
    >
      <Icon
        name={icon}
        color={disabled ? colors.white : colors.ink}
        size={21}
      />
      <Text
        style={{
          color: disabled ? colors.white : colors.ink,
          fontFamily: fonts.bold,
          fontSize: 16,
          textAlign: "center",
          flexShrink: 1,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function StylistExampleCard() {
  const { width: viewportWidth } = useWindowDimensions();
  const width = viewportWidth - 40;
  const photoWidth = Math.min(136, width * 0.39);
  const reduced = useReducedMotion();
  const ping = useRef(new Animated.Value(0)).current;
  const twinkle = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      if (reduced) {
        ping.setValue(0);
        twinkle.setValue(1);
        return;
      }
      const loops = [
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
            Animated.timing(twinkle, {
              toValue: 0.65,
              duration: 1200,
              useNativeDriver: true,
            }),
            Animated.timing(twinkle, {
              toValue: 1,
              duration: 1200,
              useNativeDriver: true,
            }),
          ]),
        ),
      ];
      loops.forEach((loop) => loop.start());
      return () => loops.forEach((loop) => loop.stop());
    }, [ping, reduced, twinkle]),
  );

  const pingScale = ping.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.8],
  });
  const pingOpacity = ping.interpolate({
    inputRange: [0, 1],
    outputRange: [0.75, 0],
  });

  return (
    <View
      style={{
        width,
        height: 232,
        alignSelf: "center",
        padding: 12,
        borderRadius: 30,
        backgroundColor: colors.ink,
        flexDirection: "row",
        gap: 12,
        ...shadow(0.25),
      }}
    >
      <View
        style={{
          width: photoWidth,
          borderRadius: 20,
          overflow: "hidden",
          backgroundColor: "#2A2640",
        }}
      >
        <Image
          source={require("../../assets/examples/stylist-sample-look.jpg")}
          contentFit="cover"
          contentPosition={{ top: "20%", left: "50%" }}
          accessibilityLabel="Example outfit: cream and black striped half-zip knit, black wide-leg trousers, tan suede tote and sunglasses"
          style={{ width: "100%", height: "100%" }}
        />
        <LinearGradient
          colors={["transparent", "rgba(20,18,31,0.45)"]}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "45%",
          }}
          pointerEvents="none"
        />
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: "44%",
            top: "45%",
            width: 18,
            height: 18,
            borderRadius: 9,
            borderWidth: 2,
            borderColor: colors.yellow,
            opacity: pingOpacity,
            transform: [{ scale: pingScale }],
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: "44%",
            top: "45%",
            marginLeft: 6,
            marginTop: 6,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.yellow,
            borderWidth: 1,
            borderColor: colors.ink,
          }}
        />
        <View
          style={{
            position: "absolute",
            left: 8,
            bottom: 8,
            borderRadius: 20,
            paddingHorizontal: 9,
            paddingVertical: 5,
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            backgroundColor: "rgba(255,255,255,0.95)",
          }}
        >
          <Icon name="sparkles" size={12} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 11 }}>On you</Text>
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingTop: 5, gap: 5 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Animated.View style={{ opacity: twinkle }}>
            <Icon name="sparkles" size={12} color={colors.yellow} />
          </Animated.View>
          <Text
            style={{
              color: colors.yellow,
              fontFamily: fonts.bold,
              fontSize: 10,
              letterSpacing: 1,
            }}
          >
            STYLED FOR YOU
          </Text>
        </View>
        <Heading size={20} style={{ color: colors.white, lineHeight: 22 }}>
          Cosy hangout fit
        </Heading>
        {[
          ["#F3EBD8", "Striped half-zip knit"],
          ["#8A8794", "Black wide-leg pants"],
          ["#C8965F", "Tan suede tote"],
          [colors.pink, "Sunglasses up top"],
        ].map(([color, label]) => (
          <View
            key={label}
            style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: color,
              }}
            />
            <Text
              numberOfLines={1}
              style={{
                color: colors.white,
                fontFamily: fonts.medium,
                fontSize: 12,
              }}
            >
              {label}
            </Text>
          </View>
        ))}
        <View
          style={{
            marginTop: "auto",
            alignSelf: "flex-start",
            backgroundColor: colors.yellow,
            borderRadius: 14,
            borderBottomLeftRadius: 4,
            paddingHorizontal: 9,
            paddingVertical: 6,
          }}
        >
          <Text
            style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.ink }}
          >
            Date night? Swap the tote for a mini bag.
          </Text>
        </View>
      </View>
      <StickerTag
        backgroundColor={colors.white}
        rotate="6deg"
        size={14}
        style={{ position: "absolute", top: -12, right: 14 }}
      >
        Styled by AI
      </StickerTag>
    </View>
  );
}
