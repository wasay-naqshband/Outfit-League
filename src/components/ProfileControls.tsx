import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "./Avatar";
import { Icon, Page, type IconName } from "./ui";
import { useReduceMotion } from "./ScanHero";
import { colors, fonts, gradients, shadow } from "../theme";

export function ProfilePage({
  title,
  edit = false,
  children,
}: {
  title: string;
  edit?: boolean;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Page scroll={false}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 16) + 24,
        }}
      >
        <LinearGradient
          colors={gradients.yellow}
          style={{
            paddingTop: 28,
            paddingHorizontal: 20,
            paddingBottom: edit ? 118 : 96,
            borderBottomLeftRadius: 34,
            borderBottomRightRadius: 34,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => router.back()}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.white,
                alignItems: "center",
                justifyContent: "center",
                ...shadow(0.12),
              }}
            >
              <Icon name="arrow-left" size={20} />
            </Pressable>
            <Text
              accessibilityRole="header"
              style={{
                flex: 1,
                fontFamily: fonts.heading,
                fontSize: 30,
                letterSpacing: -1,
                color: colors.ink,
              }}
            >
              {title}
            </Text>
          </View>
        </LinearGradient>
        {children}
      </ScrollView>
    </Page>
  );
}

export function ProfileAvatar({
  uri,
  name,
  size,
  border,
  borderColor,
}: {
  uri?: string | null;
  name?: string;
  size: number;
  border: number;
  borderColor: string;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: border,
        borderColor,
        backgroundColor: "#DCD5FF",
        ...shadow(0.12),
      }}
    >
      <Avatar
        uri={uri}
        name={name}
        size={size - border * 2}
        fallbackColor="#DCD5FF"
      />
    </View>
  );
}

export function ProfileButton({
  label,
  onPress,
  disabled = false,
  busy = false,
  saved = false,
  icon,
  style,
  circle = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  saved?: boolean;
  icon?: IconName;
  style?: ViewStyle;
  circle?: boolean;
}) {
  const reduce = useReduceMotion(true);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: circle ? 48 : 56,
          borderRadius: circle ? 24 : 18,
          borderWidth: disabled ? 0 : 2.5,
          borderColor: colors.ink,
          backgroundColor: disabled ? "#E6E1D2" : colors.yellow,
          flexDirection: "row",
          gap: 8,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ translateY: pressed && !reduce ? 2 : 0 }],
          ...Platform.select({
            web: {
              boxShadow: disabled
                ? "none"
                : `0 ${pressed && !reduce ? 0 : 4}px 0 ${colors.ink}`,
            },
            default: {
              shadowColor: colors.ink,
              shadowOffset: {
                width: 0,
                height: disabled || (pressed && !reduce) ? 0 : 4,
              },
              shadowOpacity: disabled ? 0 : 1,
              shadowRadius: 0,
              elevation: disabled ? 0 : 3,
            },
          }),
        },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={colors.ink} />
      ) : (
        <>
          {(saved || icon) && (
            <Icon name={saved ? "check" : icon!} size={circle ? 22 : 19} />
          )}{" "}
          {!circle && (
            <Text
              style={{
                fontFamily: fonts.bold,
                fontSize: 17,
                color: colors.ink,
              }}
            >
              {saved ? "Saved" : label}
            </Text>
          )}
        </>
      )}
    </Pressable>
  );
}
