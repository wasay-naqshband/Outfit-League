import React from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "./ui";
import { colors as c, fonts, shadow } from "../theme";
export const tabs = [
  { label: "Explore", icon: "compass", href: "/(tabs)" },
  { label: "Try On", icon: "sparkles", href: "/(tabs)/try-on" },
  { label: "Battles", icon: "zap", href: "/(tabs)/battles" },
  { label: "Closet", icon: "hanger", href: "/(tabs)/closet" },
] as const;
export function FloatingTabBar({
  active,
  onSelect,
}: {
  active: string;
  onSelect?: (label: string) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: Math.max(16, insets.bottom),
        height: 64,
        borderRadius: 32,
        backgroundColor: c.ink,
        padding: 8,
        flexDirection: "row",
        ...shadow(0.3),
      }}
    >
      {tabs.map((tab) => (
        <Pressable
          key={tab.label}
          accessibilityRole="tab"
          accessibilityLabel={tab.label}
          accessibilityState={{ selected: tab.label === active }}
          onPress={() =>
            onSelect ? onSelect(tab.label) : router.navigate(tab.href)
          }
          style={{
            height: 48,
            // Widths come only from flexGrow over a fixed basis: native layout kept
            // stale widths when the active tab switched to content-sized ("auto").
            flexBasis: 0,
            flexShrink: 1,
            flexGrow: tab.label === active ? 2.2 : 1,
            minWidth: 0,
            overflow: "hidden",
            borderRadius: 24,
            backgroundColor: tab.label === active ? c.yellow : "transparent",
            flexDirection: "row",
            gap: 8,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            name={tab.icon as IconName}
            color={tab.label === active ? c.ink : c.inactive}
          />
          {tab.label === active && (
            <Text
              numberOfLines={1}
              style={{ fontFamily: fonts.bold, fontSize: 16 }}
            >
              {tab.label}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}
