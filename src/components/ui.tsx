import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { art, type Outfit } from "../data";
import { colors as c, fonts as f, gradients, shadow } from "../theme";
import { useApp } from "../lib/state";
import { useWallet } from "../lib/queries";

export type IconName =
  | "compass"
  | "sparkles"
  | "zap"
  | "hanger"
  | "search"
  | "arrow-left"
  | "heart"
  | "share"
  | "shopping-bag"
  | "check"
  | "plus"
  | "user"
  | "image"
  | "x"
  | "mail";
export function Icon({
  name,
  color = c.ink,
  size = 22,
}: {
  name: IconName;
  color?: string;
  size?: number;
}) {
  if (name === "hanger" || name === "sparkles")
    return (
      <MaterialCommunityIcons
        name={name === "hanger" ? "hanger" : "star-four-points-outline"}
        size={size}
        color={color}
      />
    );
  return <Feather name={name} color={color} size={size} />;
}
export function Heading({
  children,
  size = 28,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  style?: StyleProp<import("react-native").TextStyle>;
}) {
  return (
    <Text
      style={[
        {
          fontFamily: f.heading,
          fontSize: size,
          lineHeight: size * 1.06,
          letterSpacing: -0.8,
          color: c.ink,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Body({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<import("react-native").TextStyle>;
}) {
  return (
    <Text
      style={[
        { fontFamily: f.body, fontSize: 16, lineHeight: 22, color: c.text2 },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Button({
  title,
  onPress,
  secondary,
  yellow,
  icon,
  disabled,
  style,
}: {
  title: string;
  onPress?: () => void;
  secondary?: boolean;
  yellow?: boolean;
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: secondary ? c.white : yellow ? c.yellow : c.ink,
          borderWidth: secondary ? 1.5 : 0,
          opacity: disabled ? 0.45 : pressed ? 0.78 : 1,
        },
        style,
      ]}
    >
      {icon && (
        <Icon
          name={icon}
          color={secondary || yellow ? c.ink : c.yellow}
          size={20}
        />
      )}
      <Text
        style={{
          fontFamily: f.bold,
          fontSize: 17,
          color: secondary || yellow ? c.ink : c.white,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function RoundButton({
  name,
  onPress,
  label,
}: {
  name: IconName;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={s.round}
    >
      <Icon name={name} />
    </Pressable>
  );
}
export function Logo({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={onPress ? "Profile and settings" : "Outfit League"}
      style={s.logo}
    >
      <Image
        source={require("../../assets/branding/outfit-league-logo.png")}
        contentFit="contain"
        accessibilityLabel="Outfit League hanger logo"
        style={s.logoImage}
      />
    </Pressable>
  );
}
export function CreditPill({ compact = false }: { compact?: boolean }) {
  const { session } = useApp();
  const wallet = useWallet();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Credits preview"
      onPress={() => router.push("/credits")}
      style={[s.pill, compact && { height: 36, paddingHorizontal: 12 }]}
    >
      {!compact && <Icon name="sparkles" size={16} color={c.yellow} />}
      <Text style={s.pillText}>
        {session
          ? wallet.data
            ? wallet.data.available + (compact ? " left" : " try-ons")
            : wallet.isError
              ? "Credits"
              : "Loading…"
          : compact
            ? "Demo"
            : "Demo mode"}
      </Text>
    </Pressable>
  );
}
export function DemoNote({
  text = "Demo collection · sample looks, no live services",
}: {
  text?: string;
}) {
  return <Text style={s.demo}>{text}</Text>;
}
export function CategoryChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[s.chip, selected && { backgroundColor: c.ink }]}
    >
      <Text
        style={{
          fontFamily: selected ? f.bold : f.medium,
          fontSize: 17,
          color: selected ? c.white : c.ink,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (s: string) => void;
  placeholder: string;
}) {
  return (
    <View style={s.search}>
      <Icon name="search" color={c.text3} />
      <TextInput
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={c.placeholder}
        value={value}
        onChangeText={onChangeText}
        style={s.searchInput}
      />
      {value !== "" && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText("")}
          style={s.clear}
        >
          <Icon name="x" size={18} />
        </Pressable>
      )}
    </View>
  );
}
export function AppHeader({
  title,
  query,
  onQuery,
  chips,
  selected,
  onSelect,
}: {
  title: string;
  query: string;
  onQuery: (s: string) => void;
  chips: string[];
  selected: string;
  onSelect: (s: string) => void;
}) {
  return (
    <LinearGradient colors={gradients.yellow} style={s.header}>
      <View style={s.headerRow}>
        <Logo onPress={() => router.push("/settings")} />
        <Heading size={26} style={{ flex: 1 }}>
          {title}
        </Heading>
        <CreditPill />
      </View>
      <View style={{ marginHorizontal: 20, marginTop: 14 }}>
        <SearchField
          value={query}
          onChangeText={onQuery}
          placeholder={
            title === "Closet"
              ? "Search your saved looks"
              : "Search fits, styles, brands"
          }
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
        style={{ marginTop: 14, flexGrow: 0 }}
      >
        {chips.map((label) => (
          <CategoryChip
            key={label}
            label={label}
            selected={selected === label}
            onPress={() => onSelect(label)}
          />
        ))}
      </ScrollView>
    </LinearGradient>
  );
}
export function FlatHeader({
  title,
  pill,
  children,
}: {
  title: string;
  pill?: string;
  children?: React.ReactNode;
}) {
  const compact = useWindowDimensions().width <= 360;
  return (
    <View style={{ marginBottom: children ? 24 : 18 }}>
      <LinearGradient
        colors={gradients.yellow}
        style={children ? { height: 129 } : { minHeight: 102 }}
      >
        <View
          style={[
            s.headerRow,
            { paddingTop: 28, paddingBottom: children ? 0 : 28, gap: 12 },
          ]}
        >
          <RoundButton
            name="arrow-left"
            label="Back"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/(tabs)")
            }
          />
          <Heading
            size={compact ? 23 : title === "Shop the look" ? 26 : 28}
            style={{ flex: 1 }}
          >
            {title}
          </Heading>
          {pill ? (
            <View style={[s.pill, { height: 36, paddingHorizontal: 12 }]}>
              <Text style={s.pillText}>{pill}</Text>
            </View>
          ) : (
            <CreditPill compact={compact} />
          )}
        </View>
      </LinearGradient>
      {children && (
        <View style={{ position: "absolute", left: 20, right: 20, top: 86 }}>
          {children}
        </View>
      )}
    </View>
  );
}
export function SegmentedControl({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={s.segment}>
      {options.map((item) => (
        <Pressable
          key={item}
          accessibilityRole="button"
          accessibilityState={{ selected: item === selected }}
          onPress={() => onChange(item)}
          style={[
            s.segmentItem,
            selected === item && { backgroundColor: c.ink },
          ]}
        >
          <Text
            style={{
              fontFamily: selected === item ? f.bold : f.medium,
              fontSize: 17,
              color: selected === item ? c.white : c.ink,
            }}
          >
            {item}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function StickerBadge({
  children,
  color = c.pink,
  rotate = "-5deg",
  style,
  size = 15,
}: {
  children: React.ReactNode;
  color?: string;
  rotate?: string;
  style?: StyleProp<ViewStyle>;
  size?: number;
}) {
  return (
    <View
      style={[
        s.sticker,
        {
          backgroundColor: color,
          transform: [{ rotate: rotate as `${number}deg` }],
        },
        style,
      ]}
    >
      <Text style={{ fontFamily: f.heading, color: c.ink, fontSize: size }}>
        {children}
      </Text>
    </View>
  );
}
export function Figure({
  image,
  scale = 0.84,
  bottom = 0,
}: {
  image: keyof typeof art;
  scale?: number;
  bottom?: number;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: `${(1 - scale) * 50}%`,
        right: `${(1 - scale) * 50}%`,
        bottom,
        aspectRatio: 120 / 140,
      }}
    >
      <Image
        source={art[image]}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        accessibilityLabel={`${image} sample outfit illustration`}
      />
    </View>
  );
}
export function OutfitLabelBar({
  outfit,
  onTry,
  caption,
}: {
  outfit: Outfit;
  onTry: () => void;
  caption?: string;
}) {
  const compact = useWindowDimensions().width <= 360;
  return (
    <View
      style={[
        s.labelBar,
        compact && { paddingLeft: 8, paddingRight: 4, gap: 2 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Heading size={compact ? 12 : 15} style={{ letterSpacing: -0.2 }}>
          {outfit.name}
        </Heading>
        {!compact && (
          <Text style={{ fontFamily: f.body, fontSize: 13, color: c.text3 }}>
            {caption ?? outfit.category}
          </Text>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Try ${outfit.name}`}
        onPress={onTry}
        style={s.sparkle}
      >
        <Icon name="sparkles" size={19} color={c.yellow} />
      </Pressable>
    </View>
  );
}
export function OutfitCard({
  outfit,
  height = 228,
  label = false,
  sticker,
  source = false,
  onPress,
  onTry,
  caption,
}: {
  outfit: Outfit;
  height?: number;
  label?: boolean;
  sticker?: string;
  source?: boolean;
  onPress?: () => void;
  onTry?: () => void;
  caption?: string;
}) {
  return (
    <View style={[s.cardShadow, { height }]}>
      <LinearGradient colors={gradients[outfit.palette]} style={s.card}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={"Open " + outfit.name}
          onPress={
            onPress ??
            (() =>
              router.push({
                pathname: "/outfit/[id]",
                params: { id: outfit.id },
              }))
          }
          style={StyleSheet.absoluteFill}
        >
          <Figure image={outfit.image} bottom={label ? 64 : 0} />
          {source && (
            <View style={s.source}>
              <Text style={{ fontFamily: f.bold, fontSize: 12 }}>
                {outfit.source}
              </Text>
            </View>
          )}
          {sticker && (
            <StickerBadge
              style={{
                position: "absolute",
                top: 8,
                left: sticker === "New" ? undefined : 6,
                right: sticker === "New" ? 8 : undefined,
              }}
              rotate={sticker === "New" ? "5deg" : "-6deg"}
              color={sticker === "New" ? c.white : c.pink}
            >
              {sticker}
            </StickerBadge>
          )}
        </Pressable>
        {label && (
          <OutfitLabelBar
            caption={caption}
            outfit={outfit}
            onTry={
              onTry ??
              (() =>
                router.push({
                  pathname: "/(tabs)/try-on",
                  params: { look: outfit.id },
                }))
            }
          />
        )}
      </LinearGradient>
    </View>
  );
}
export function HeroCard({
  outfit,
  before = false,
}: {
  outfit: Outfit;
  before?: boolean;
}) {
  return (
    <View style={[s.cardShadow, { height: 359, borderRadius: 32 }]}>
      <LinearGradient
        colors={gradients[before ? "coral" : outfit.palette]}
        style={[s.card, { borderRadius: 32 }]}
      >
        <Figure image={before ? "cream" : outfit.image} scale={1.12} />
        <View
          style={[
            s.source,
            { top: 14, left: 14, height: 34, flexDirection: "row", gap: 6 },
          ]}
        >
          <Icon name="sparkles" size={15} />
          <Text style={{ fontFamily: f.bold, fontSize: 14 }}>
            {before ? "Before · sample" : "AI preview · demo"}
          </Text>
        </View>
        {!before && (
          <StickerBadge
            size={18}
            style={{
              position: "absolute",
              right: 12,
              bottom: 30,
              paddingVertical: 8,
            }}
          >
            Looks good on you
          </StickerBadge>
        )}
      </LinearGradient>
    </View>
  );
}
export function DarkPromoCard({ closet = false }: { closet?: boolean }) {
  return (
    <View style={s.promo}>
      <Heading size={22} style={{ color: c.white }}>
        {closet ? "Shop saved look" : "Battle of the day"}
      </Heading>
      <Body style={{ fontSize: 14, lineHeight: 18, color: "#C9C5D6" }}>
        {closet
          ? "Similar and budget demo picks."
          : "Hoodie or bomber. Which fit wins?"}
      </Body>
      <Button
        yellow
        title={closet ? "Find it" : "Vote now"}
        onPress={() => router.push(closet ? "/shop" : "/(tabs)/battles")}
        style={{
          minHeight: 44,
          height: 44,
          borderRadius: 16,
          marginTop: "auto",
        }}
      />
    </View>
  );
}
export function Page({
  children,
  scroll = true,
  keyboardInsets = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  keyboardInsets?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.cream, paddingTop: insets.top }}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={keyboardInsets}
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom, 16) + 100,
          }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </View>
  );
}
export function EmptyState({
  title,
  message,
  action,
  onPress,
}: {
  title: string;
  message: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View
      style={{
        padding: 24,
        gap: 12,
        backgroundColor: c.white,
        borderRadius: 28,
      }}
    >
      <Icon name="hanger" size={36} />
      <Heading size={24}>{title}</Heading>
      <Body>{message}</Body>
      {action && <Button title={action} onPress={onPress} />}
    </View>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <EmptyState
      title="Let’s try that again"
      message={message}
      action="Try again"
      onPress={retry}
    />
  );
}
export function LoadingSkeleton() {
  return (
    <View
      accessibilityLabel="Loading"
      style={{
        height: 220,
        backgroundColor: c.chip,
        borderRadius: 28,
        justifyContent: "center",
      }}
    >
      <ActivityIndicator color={c.ink} />
    </View>
  );
}
export function ActionTile({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={s.action}
    >
      <Icon name={icon} />
      <Text style={{ fontFamily: f.bold, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}
export function ImageUploadTile({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 172,
        borderRadius: 28,
        borderWidth: 4,
        borderColor: c.white,
        backgroundColor: "#DCD5FF",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
      }}
    >
      <Icon name="image" size={32} />
      <Text style={{ fontFamily: f.bold, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: 18,
    borderColor: c.ink,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.white,
    alignItems: "center",
    justifyContent: "center",
    ...shadow(0.08),
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: c.cream,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImage: {
    position: "absolute",
    width: 112,
    height: 112,
    left: -37,
    top: -23,
  },
  pill: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: c.ink,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pillText: { fontFamily: f.bold, fontSize: 13, color: c.white },
  demo: {
    fontFamily: f.medium,
    fontSize: 12,
    lineHeight: 17,
    color: c.text3,
    textAlign: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  header: {
    height: 214,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    paddingTop: 28,
    ...shadow(0.1),
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
  },
  search: {
    height: 52,
    borderRadius: 20,
    backgroundColor: c.white,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 18,
    paddingRight: 10,
    gap: 12,
    ...shadow(0.04),
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 52,
    fontFamily: f.body,
    fontSize: 17,
    color: c.ink,
    ...(Platform.OS === "web" ? { outlineStyle: "none" as never } : {}),
  },
  clear: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: c.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  segment: {
    height: 52,
    padding: 6,
    borderRadius: 20,
    backgroundColor: c.white,
    flexDirection: "row",
    gap: 4,
    ...shadow(0.06),
  },
  segmentItem: {
    flex: 1,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  sticker: {
    borderWidth: 3,
    borderColor: c.white,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    ...shadow(0.16),
  },
  cardShadow: { borderRadius: 28, ...shadow() },
  card: {
    flex: 1,
    borderWidth: 4,
    borderColor: c.white,
    borderRadius: 28,
    overflow: "hidden",
  },
  source: {
    position: "absolute",
    left: 8,
    top: 8,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 17,
    backgroundColor: c.white,
    alignItems: "center",
    justifyContent: "center",
  },
  labelBar: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    height: 56,
    paddingLeft: 10,
    paddingRight: 6,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.94)",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sparkle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  promo: {
    height: 170,
    padding: 14,
    borderRadius: 28,
    borderWidth: 4,
    borderColor: c.white,
    backgroundColor: c.ink,
    gap: 6,
    ...shadow(),
  },
  action: {
    flex: 1,
    height: 64,
    borderRadius: 20,
    backgroundColor: c.white,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    ...shadow(0.04),
  },
});
