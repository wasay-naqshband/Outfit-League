import React, { useCallback, useRef } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { Avatar } from "./Avatar";
import { Heading, Icon } from "./ui";
import { colors, fonts, shadow } from "../theme";
import { useReducedMotion } from "./Redesign";

function PollCard({ onPress }: { onPress: () => void }) {
  const reduced = useReducedMotion();
  const ripple = useRef(new Animated.Value(0)).current;
  const plus = useRef(new Animated.Value(0)).current;
  const bars = useRef(new Animated.Value(0)).current;
  useFocusEffect(
    useCallback(() => {
      if (reduced) {
        ripple.setValue(0);
        plus.setValue(0);
        bars.setValue(1);
        return;
      }
      const loops = [
        Animated.loop(
          Animated.timing(ripple, {
            toValue: 1,
            duration: 1600,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(plus, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(plus, {
              toValue: 0,
              duration: 800,
              useNativeDriver: true,
            }),
          ]),
        ),
      ];
      Animated.timing(bars, {
        toValue: 1,
        duration: 1100,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
      loops.forEach((loop) => loop.start());
      return () => loops.forEach((loop) => loop.stop());
    }, [bars, plus, reduced, ripple]),
  );
  const rippleScale = ripple.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 2.4],
  });
  const rippleOpacity = ripple.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 0],
  });
  const plusY = plus.interpolate({ inputRange: [0, 1], outputRange: [8, -12] });
  const plusOpacity = plus.interpolate({
    inputRange: [0, 0.1, 0.8, 1],
    outputRange: [0, 1, 1, 0],
  });
  const barA = bars.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "70%"],
  });
  const barB = bars.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "30%"],
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Help me choose. Two fits. Friends tap to vote. Start a poll."
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
          () => {},
        );
        onPress();
      }}
      style={({ pressed }) => ({
        minHeight: 182,
        borderRadius: 28,
        borderWidth: 4,
        borderColor: colors.white,
        overflow: "hidden",
        opacity: pressed ? 0.95 : 1,
        transform: [{ translateY: pressed ? 2 : 0 }],
        ...shadow(0.12),
      })}
    >
      <LinearGradient
        colors={["#E9E5FF", "#B9ACFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, minHeight: 174, flexDirection: "row", padding: 14 }}
      >
        <View
          style={{
            width: "45%",
            justifyContent: "space-between",
            paddingVertical: 4,
          }}
        >
          <View style={{ gap: 5 }}>
            <Heading size={23} style={{ lineHeight: 25 }}>
              Help me choose
            </Heading>
            <Text
              style={{
                color: "#3B3647",
                fontFamily: fonts.body,
                fontSize: 13,
                lineHeight: 17,
              }}
            >
              Two fits. Friends tap to vote.
            </Text>
          </View>
          <View
            style={{
              minHeight: 44,
              alignSelf: "flex-start",
              borderRadius: 14,
              paddingHorizontal: 13,
              backgroundColor: colors.ink,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Text
              style={{
                color: colors.white,
                fontFamily: fonts.bold,
                fontSize: 14,
              }}
            >
              Start a poll
            </Text>
            <Icon name="arrow-right" size={17} color={colors.yellow} />
          </View>
        </View>
        <View style={{ flex: 1, justifyContent: "flex-end", paddingLeft: 4 }}>
          <View
            style={{
              height: 116,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 62,
                height: 84,
                borderRadius: 14,
                backgroundColor: colors.white,
                transform: [{ rotate: "-8deg" }],
                alignItems: "center",
                justifyContent: "center",
                ...shadow(0.16),
              }}
            >
              <Text
                style={{
                  position: "absolute",
                  top: 5,
                  left: 7,
                  fontFamily: fonts.bold,
                }}
              >
                A
              </Text>
              <Icon name="hanger" size={34} />
            </View>
            <View
              style={{
                width: 62,
                height: 84,
                borderRadius: 14,
                backgroundColor: colors.ink,
                transform: [{ rotate: "7deg" }],
                alignItems: "center",
                justifyContent: "center",
                marginLeft: -4,
                ...shadow(0.16),
              }}
            >
              <Text
                style={{
                  position: "absolute",
                  top: 5,
                  left: 7,
                  color: colors.yellow,
                  fontFamily: fonts.bold,
                }}
              >
                B
              </Text>
              <Icon name="hanger" size={34} color={colors.white} />
            </View>
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: "22%",
                top: 38,
                width: 22,
                height: 22,
                borderWidth: 3,
                borderColor: colors.ink,
                borderRadius: 11,
                opacity: rippleOpacity,
                transform: [{ scale: rippleScale }],
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: "27%",
                top: 43,
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: colors.yellow,
                borderWidth: 2,
                borderColor: colors.ink,
              }}
            />
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: "13%",
                top: 1,
                backgroundColor: colors.pink,
                borderColor: colors.white,
                borderWidth: 2,
                borderRadius: 12,
                paddingHorizontal: 7,
                paddingVertical: 2,
                opacity: plusOpacity,
                transform: [{ translateY: plusY }, { rotate: "-8deg" }],
              }}
            >
              <Text style={{ fontFamily: fonts.heading, fontSize: 13 }}>
                +1
              </Text>
            </Animated.View>
          </View>
          <View style={{ gap: 5, paddingHorizontal: 2 }}>
            {[
              { label: "A", share: barA, color: colors.ink },
              { label: "B", share: barB, color: colors.white },
            ].map((bar) => (
              <View
                key={bar.label}
                style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
              >
                <Text
                  style={{ fontFamily: fonts.bold, fontSize: 10, width: 9 }}
                >
                  {bar.label}
                </Text>
                <View
                  style={{
                    flex: 1,
                    height: 8,
                    borderRadius: 4,
                    overflow: "hidden",
                    backgroundColor: "rgba(255,255,255,0.6)",
                  }}
                >
                  <Animated.View
                    style={{
                      width: bar.share,
                      height: "100%",
                      borderRadius: 4,
                      backgroundColor: bar.color,
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function FriendCard({ onPress }: { onPress: () => void }) {
  const reduced = useReducedMotion();
  const motion = useRef(new Animated.Value(0)).current;
  useFocusEffect(
    useCallback(() => {
      if (reduced) {
        motion.setValue(0);
        return;
      }
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(motion, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(motion, {
            toValue: 0,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }, [motion, reduced]),
  );
  const rotation = motion.interpolate({
    inputRange: [0, 1],
    outputRange: ["-8deg", "8deg"],
  });
  const scale = motion.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });
  const flicker = motion.interpolate({
    inputRange: [0, 0.45, 0.5, 0.55, 1],
    outputRange: [1, 1, 0.35, 1, 1],
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Battle a friend. Your look versus theirs. Squad decides. Challenge."
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
          () => {},
        );
        onPress();
      }}
      style={({ pressed }) => ({
        minHeight: 182,
        borderRadius: 28,
        borderWidth: 4,
        borderColor: colors.white,
        overflow: "hidden",
        opacity: pressed ? 0.95 : 1,
        transform: [{ translateY: pressed ? 2 : 0 }],
        ...shadow(0.12),
      })}
    >
      <LinearGradient
        colors={["#FFDCD3", "#FF7A66"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flex: 1,
          minHeight: 174,
          flexDirection: "row",
          alignItems: "center",
          padding: 12,
        }}
      >
        <View
          style={{
            width: "45%",
            height: 142,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Animated.View
            style={{
              position: "absolute",
              top: 2,
              left: "42%",
              opacity: flicker,
              transform: [{ rotate: "12deg" }],
            }}
          >
            <Icon name="zap" size={50} color={colors.yellow} />
          </Animated.View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                borderWidth: 3,
                borderColor: colors.white,
                backgroundColor: "#DCD5FF",
                alignItems: "center",
                justifyContent: "center",
                ...shadow(0.15),
              }}
            >
              <Avatar name="Y" size={48} />
            </View>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                borderWidth: 3,
                borderColor: colors.white,
                backgroundColor: "#CFF5E4",
                alignItems: "center",
                justifyContent: "center",
                marginLeft: -7,
                ...shadow(0.15),
              }}
            >
              <Avatar name="F" size={48} />
            </View>
          </View>
          <Animated.View
            style={{
              position: "absolute",
              top: 51,
              left: "36%",
              width: 42,
              height: 42,
              borderRadius: 21,
              borderWidth: 3,
              borderColor: colors.white,
              backgroundColor: colors.ink,
              alignItems: "center",
              justifyContent: "center",
              transform: [{ rotate: rotation }, { scale }],
            }}
          >
            <Text
              style={{
                color: colors.yellow,
                fontFamily: fonts.heading,
                fontSize: 14,
              }}
            >
              VS
            </Text>
          </Animated.View>
          <View
            style={{
              position: "absolute",
              bottom: 4,
              left: 0,
              right: 0,
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            {["You", "Friend"].map((label) => (
              <Text
                key={label}
                style={{
                  backgroundColor: colors.white,
                  borderRadius: 20,
                  paddingHorizontal: 9,
                  paddingVertical: 3,
                  fontFamily: fonts.bold,
                  fontSize: 11,
                }}
              >
                {label}
              </Text>
            ))}
          </View>
        </View>
        <View
          style={{
            flex: 1,
            alignSelf: "stretch",
            justifyContent: "space-between",
            paddingVertical: 4,
            paddingLeft: 4,
          }}
        >
          <View style={{ gap: 5 }}>
            <Heading size={22} style={{ lineHeight: 23 }}>
              Battle a friend
            </Heading>
            <Text
              style={{
                color: "#3B3647",
                fontFamily: fonts.body,
                fontSize: 13,
                lineHeight: 17,
              }}
            >
              Your look vs theirs. Squad decides.
            </Text>
          </View>
          <View
            style={{
              minHeight: 44,
              alignSelf: "flex-start",
              borderRadius: 14,
              paddingHorizontal: 13,
              backgroundColor: colors.ink,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Text
              style={{
                color: colors.white,
                fontFamily: fonts.bold,
                fontSize: 14,
              }}
            >
              Challenge
            </Text>
            <Icon name="arrow-right" size={17} color={colors.yellow} />
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export function BattleModeCards({
  onChoose,
  onVersus,
}: {
  onChoose: () => void;
  onVersus: () => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      <PollCard onPress={onChoose} />
      <FriendCard onPress={onVersus} />
    </View>
  );
}
