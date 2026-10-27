import React, { useCallback, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { Icon, StickerBadge } from "./ui";
import { TactileButton, useReduceMotion } from "./ScanHero";
import { colors, fonts, shadow } from "../theme";

const art = {
  jeans: require("../../assets/closet/jeans.png"),
  sneaker: require("../../assets/closet/sneaker.png"),
  hanger: require("../../assets/closet/hanger.png"),
};

// translateY 0 → -6 → 0 on a loop while the screen is focused.
function useBob(
  duration: number,
  delay: number,
  off: boolean,
  rotate = "0deg",
) {
  const y = useRef(new Animated.Value(0)).current;
  useFocusEffect(
    useCallback(() => {
      if (off) return;
      const ease = Easing.inOut(Easing.ease);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(y, {
            toValue: -6,
            duration: duration / 2,
            easing: ease,
            useNativeDriver: true,
          }),
          Animated.timing(y, {
            toValue: 0,
            duration: duration / 2,
            easing: ease,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => {
        loop.stop();
        y.setValue(0);
      };
    }, [off, y, duration, delay]),
  );
  return { transform: [{ translateY: y }, { rotate }] };
}

export function AddItemDropZone({
  imageUri,
  reading,
  helper,
  disabled,
  onCamera,
  onGallery,
}: {
  imageUri?: string | null;
  reading?: boolean;
  helper: string;
  disabled?: boolean;
  onCamera: () => void;
  onGallery: () => void;
}) {
  const reduce = useReduceMotion();
  const still = reduce || !!imageUri;
  const bobA = useBob(4000, 0, still, "-10deg"),
    bobB = useBob(4000, 800, still, "9deg"),
    bobC = useBob(3200, 400, still);
  const camera = Platform.OS !== "web";
  return (
    <LinearGradient
      colors={["#EEEAFF", "#C9BEFF", "#A9E6CC"]}
      locations={[0, 0.55, 1]}
      start={{ x: 0.3, y: 0 }}
      end={{ x: 0.7, y: 1 }}
      style={{
        height: 316,
        borderRadius: 30,
        borderWidth: 4,
        borderColor: colors.white,
        overflow: "hidden",
        ...shadow(0.14),
      }}
    >
      {imageUri ? (
        <View style={{ position: "absolute", inset: 10 } as ViewStyle}>
          <Image
            source={{ uri: imageUri }}
            cachePolicy="none"
            contentFit="cover"
            transition={200}
            style={{ flex: 1, borderRadius: 22 }}
            accessibilityLabel="Your clothing photo"
          />
          {reading && (
            <View
              accessibilityLiveRegion="polite"
              style={{
                position: "absolute",
                top: 96,
                alignSelf: "center",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: colors.white,
                borderRadius: 999,
                paddingVertical: 10,
                paddingHorizontal: 16,
                ...shadow(0.18),
              }}
            >
              <ActivityIndicator size="small" color={colors.ink} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 14 }}>
                Reading your item…
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ position: "absolute", inset: 0 } as ViewStyle}
        >
          <View
            style={{
              position: "absolute",
              inset: 10,
              borderRadius: 22,
              borderWidth: 2,
              borderStyle: "dashed",
              borderColor: "rgba(20,18,31,0.22)",
            } as ViewStyle}
          />
          <Animated.View
            style={[
              {
                position: "absolute",
                left: 26,
                top: 30,
                width: 70,
                height: 80,
                borderRadius: 16,
                backgroundColor: colors.white,
                alignItems: "center",
                justifyContent: "center",
                ...shadow(0.16),
              },
              bobA,
            ]}
          >
            <Image source={art.jeans} style={{ width: 46, height: 46 }} />
          </Animated.View>
          <Animated.View
            style={[
              {
                position: "absolute",
                right: 26,
                top: 26,
                width: 76,
                height: 72,
                borderRadius: 16,
                backgroundColor: colors.ink,
                alignItems: "center",
                justifyContent: "center",
                ...shadow(0.2),
              },
              bobB,
            ]}
          >
            <Image source={art.sneaker} style={{ width: 52, height: 52 }} />
          </Animated.View>
          <Animated.View
            style={[
              { position: "absolute", top: 20, alignSelf: "center" },
              bobC,
            ]}
          >
            <Image source={art.hanger} style={{ width: 132, height: 150 }} />
            <StickerBadge
              color={colors.yellow}
              rotate="-6deg"
              size={14}
              style={{ position: "absolute", left: -48, top: 106 }}
            >
              One piece at a time
            </StickerBadge>
          </Animated.View>
          <Text
            style={{
              position: "absolute",
              top: 196,
              left: 16,
              right: 16,
              textAlign: "center",
              fontFamily: fonts.medium,
              fontSize: 14,
              color: "#3B3647",
            }}
          >
            {helper}
          </Text>
        </View>
      )}
      <View
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          bottom: 16,
          flexDirection: "row",
          gap: 10,
        }}
      >
        {camera && (
          <TactileButton
            icon="camera"
            title={imageUri ? "Retake" : "Take photo"}
            disabled={disabled}
            style={{ flex: 1.2 }}
            onPress={onCamera}
          />
        )}
        <TactileButton
          icon="image"
          title={imageUri ? "Change" : "Gallery"}
          fill={colors.white}
          disabled={disabled}
          style={{ flex: 1 }}
          onPress={onGallery}
        />
      </View>
    </LinearGradient>
  );
}

export type AutoFill = {
  category?: string;
  colour?: string;
  style?: string;
  name?: string;
};

function Chip({ label, value }: { label: string; value?: string }) {
  const pop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!value) return;
    pop.setValue(0.9);
    Animated.spring(pop, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  }, [value, pop]);
  return (
    <Animated.View
      accessible
      accessibilityLabel={value ? `${label}: ${value}` : `${label}, not set yet`}
      style={[
        {
          height: 34,
          borderRadius: 999,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          transform: [{ scale: pop }],
        },
        value
          ? { backgroundColor: colors.white, ...shadow(0.08) }
          : {
              borderWidth: 1.5,
              borderStyle: "dashed",
              borderColor: "#B9B3A3",
            },
      ]}
    >
      {label === "Colour" && !value && (
        <LinearGradient
          colors={["#FF9BD2", "#FFE93B", "#8EDDBC", "#B9ACFF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 12, height: 12, borderRadius: 6 }}
        />
      )}
      <Text
        numberOfLines={1}
        style={{
          maxWidth: 150,
          fontFamily: fonts.bold,
          fontSize: 13,
          color: value ? colors.ink : "#4B475A",
        }}
      >
        {value || label}
      </Text>
    </Animated.View>
  );
}

export function AutoFillChips({ values }: { values: AutoFill }) {
  const reduce = useReduceMotion();
  const twinkle = useRef(new Animated.Value(1)).current;
  useFocusEffect(
    useCallback(() => {
      if (reduce) return;
      const half = {
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      };
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(twinkle, { toValue: 0.35, ...half }),
          Animated.timing(twinkle, { toValue: 1, ...half }),
        ]),
      );
      loop.start();
      return () => {
        loop.stop();
        twinkle.setValue(1);
      };
    }, [reduce, twinkle]),
  );
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Animated.View style={{ opacity: twinkle }}>
          <Icon name="sparkles" size={14} />
        </Animated.View>
        <Text
          style={{
            fontFamily: fonts.bold,
            fontSize: 12,
            letterSpacing: 1.2,
            color: "#4B475A",
          }}
        >
          AI FILLS THESE IN
        </Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Chip label="Category" value={values.category} />
        <Chip label="Colour" value={values.colour} />
        <Chip label="Style" value={values.style} />
        <Chip label="Name" value={values.name} />
      </View>
    </View>
  );
}
