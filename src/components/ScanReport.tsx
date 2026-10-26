import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AccessibilityInfo,
  Animated,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Body, Button, CreditPill, Heading, Icon, StickerBadge } from "./ui";
import { colors, fonts, gradients, shadow } from "../theme";
import { pieceLink, type Lookalike, type Scan } from "../lib/tryon-api";
import type { LocalPhoto } from "../types/tryon";
import { analytics } from "../lib/analytics";

const statusColors = {
  good: ["#DDF5E8", "#0E6B45"],
  mixed: ["#FFF1C2", "#8A5A00"],
  poor: ["#FFE0DB", "#A3321F"],
} as const;
const tileColors = [
  gradients.lavender,
  gradients.mint,
  gradients.coral,
  gradients.butter,
];

export function ScanReport({
  photo,
  scan,
  items,
  saved,
  saving,
  error,
  onBack,
  onShare,
  onSave,
  onTryOn,
  onScanAnother,
  onGallery,
}: {
  photo: LocalPhoto;
  scan: Scan;
  items: Lookalike[];
  saved: boolean;
  saving: boolean;
  error: string;
  onBack: () => void;
  onShare: () => void;
  onSave: () => void;
  onTryOn: () => void;
  onScanAnother: () => void;
  onGallery: () => void;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [reducedMotion, setReducedMotion] = useState(false);
  const [opening, setOpening] = useState(-1);
  const [shopError, setShopError] = useState("");
  const photoWidth = Math.min(300, width - 90);
  const hasPoint = scan.annotations?.some((item) => item.point);
  const missingPoint = scan.annotations?.filter((item) => !item.point) ?? [];
  const priceValues = scan.priceRange
    ? [scan.priceRange.low, scan.priceRange.high]
    : [...scan.price.matchAll(/\d+(?:\.\d+)?/g)].map((match) =>
        Number(match[0]),
      );
  const priceLow = priceValues[0];
  const displayPrice =
    scan.price ||
    (Number.isFinite(priceLow)
      ? `$${priceLow}–${priceValues[1] ?? priceLow}`
      : "");
  const cheapest = Math.min(...items.map((item) => item.price ?? Infinity));

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReducedMotion,
    );
    return () => subscription.remove();
  }, []);

  async function shop(index: number) {
    if (opening >= 0) return;
    setOpening(index);
    setShopError("");
    try {
      analytics.track("shop_look_clicked", { part: "accessory" });
      await Linking.openURL((await pieceLink(items[index]!)).url);
    } catch {
      setShopError("This store link couldn’t open. Try again.");
    } finally {
      setOpening(-1);
    }
  }

  return (
    <View
      style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.cream }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 16) + 230,
        }}
      >
        <LinearGradient
          colors={["#FFF7A8", colors.yellow, "#FFDD1F"]}
          locations={[0, 0.5, 1]}
          style={{
            height: missingPoint.length ? 652 : 606,
            borderBottomLeftRadius: 36,
            borderBottomRightRadius: 36,
            ...shadow(0.1),
          }}
        >
          <View
            style={{
              position: "absolute",
              top: 28,
              left: 20,
              right: 20,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Round icon="arrow-left" label="Back" onPress={onBack} />
            <Heading size={22} style={{ flex: 1, letterSpacing: -0.6 }}>
              Fit report
            </Heading>
            <Round icon="share" label="Share" onPress={onShare} />
            <CreditPill compact />
          </View>

          <View
            style={{
              position: "absolute",
              top: 92,
              left: (width - photoWidth) / 2,
              width: photoWidth,
              height: 360,
              transform: [{ rotate: "-2deg" }],
            }}
          >
            <View
              style={{
                ...shadow(0.28),
                borderWidth: 6,
                borderColor: colors.white,
                borderRadius: 30,
                overflow: "hidden",
                width: "100%",
                height: "100%",
                backgroundColor: colors.ink,
              }}
            >
              <Image
                source={{ uri: photo.uri }}
                contentFit="cover"
                contentPosition={{ left: "50%", top: "35%" }}
                accessibilityLabel={`Your scan: ${scan.name}`}
                style={{ width: "100%", height: "100%" }}
              />
            </View>
            {scan.annotations?.map((item, index) => {
              if (!item.point) return null;
              const scale = Math.max(
                photoWidth / photo.width,
                360 / photo.height,
              );
              const x = Math.max(
                8,
                Math.min(
                  photoWidth - 8,
                  item.point.x * photo.width * scale -
                    (photo.width * scale - photoWidth) / 2,
                ),
              );
              const y = Math.max(
                8,
                Math.min(
                  352,
                  item.point.y * photo.height * scale -
                    (photo.height * scale - 360) * 0.35,
                ),
              );
              return (
                <React.Fragment key={`${item.label}-${index}`}>
                  <Ping
                    active={focused && !reducedMotion}
                    delay={index * 500}
                    style={{ left: x - 7, top: y - 7 }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      left: x - 7,
                      top: y - 7,
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      backgroundColor: colors.yellow,
                      borderWidth: 3,
                      borderColor: colors.ink,
                    }}
                  />
                  <Sticker
                    delay={index * 200}
                    active={focused && !reducedMotion}
                    style={{
                      position: "absolute",
                      top: Math.max(0, Math.min(310, y - 26)),
                      ...(item.point.x < 0.5 ? { left: -30 } : { right: -22 }),
                    }}
                    color={
                      index === 2
                        ? colors.ink
                        : index === 1
                          ? colors.pink
                          : colors.white
                    }
                    textColor={index === 2 ? colors.yellow : colors.ink}
                  >
                    {item.label}
                  </Sticker>
                </React.Fragment>
              );
            })}
          </View>

          {!!missingPoint.length && (
            <View
              style={{
                position: "absolute",
                top: 458,
                left: 20,
                right: 20,
                flexDirection: "row",
                justifyContent: "center",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              {missingPoint.map((item, index) => (
                <Tag key={index}>{item.label}</Tag>
              ))}
            </View>
          )}
          <View
            style={{
              position: "absolute",
              top: missingPoint.length ? 500 : 478,
              left: 20,
              right: 20,
              alignItems: "center",
              gap: 10,
            }}
          >
            <Heading
              size={27}
              style={{
                textAlign: "center",
                lineHeight: 28,
                letterSpacing: -0.9,
              }}
            >
              {scan.name}
            </Heading>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {!!scan.vibe && <Chip dark>{scan.vibe}</Chip>}
              {!!displayPrice && <Chip>{displayPrice}</Chip>}
              {!!scan.category && <Chip>{scan.category}</Chip>}
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingTop: 26, gap: 28 }}>
          <View style={{ paddingHorizontal: 20, gap: 14 }}>
            <View
              style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}
            >
              <View
                style={{
                  position: "relative",
                  flexDirection: "row",
                  alignItems: "baseline",
                }}
              >
                <Text
                  accessibilityLabel={`Score ${scan.score} out of 10. ${scan.verdict}`}
                  style={{
                    fontFamily: fonts.heading,
                    fontSize: 112,
                    lineHeight: 90,
                    letterSpacing: -5,
                    color: colors.ink,
                  }}
                >
                  {scan.score}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.heading,
                    fontSize: 26,
                    color: colors.text3,
                  }}
                >
                  /10
                </Text>
                <StickerBadge
                  size={20}
                  rotate="8deg"
                  style={{ position: "absolute", left: 36, top: -22 }}
                >
                  Vibe check
                </StickerBadge>
              </View>
              <Body
                style={{
                  flex: 1,
                  paddingBottom: 4,
                  fontSize: 15,
                  lineHeight: 20,
                }}
              >
                {scan.verdict}
              </Body>
            </View>
            <View
              accessibilityRole="image"
              accessibilityLabel={`${scan.score} out of 10`}
              style={{ flexDirection: "row", gap: 5 }}
            >
              {Array.from({ length: 10 }, (_, index) => (
                <MeterBlock
                  key={index}
                  filled={index < scan.score}
                  highlight={index === scan.score - 1}
                  index={index}
                  animate={focused && !reducedMotion}
                />
              ))}
            </View>
            {scan.verdicts && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <VerdictTile title="STYLE" item={scan.verdicts.style} />
                <VerdictTile title="COLOUR" item={scan.verdicts.colour} />
              </View>
            )}
            {!!scan.vibeLine && (
              <Body style={{ color: colors.text2 }}>{scan.vibeLine}</Body>
            )}
          </View>

          {!!scan.details.length && (
            <View style={{ gap: 14 }}>
              <Heading size={22} style={{ paddingHorizontal: 20 }}>
                The breakdown
              </Heading>
              <ScrollView
                horizontal
                snapToInterval={148}
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}
              >
                {scan.details.map((detail, index) => (
                  <DetailTile
                    key={`${detail.label}-${index}`}
                    detail={detail}
                    index={index}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {!!scan.colors.length && (
            <View style={{ paddingHorizontal: 20, gap: 14 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Heading size={22}>Palette</Heading>
                {!!scan.pairing && (
                  <Text
                    style={{
                      fontFamily: fonts.bold,
                      fontSize: 14,
                      color: colors.text2,
                    }}
                  >
                    + a pairing
                  </Text>
                )}
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {scan.colors
                  .slice(0, scan.pairing ? 2 : 3)
                  .map((color, index) => (
                    <PaintChip
                      key={`${color.hex}-${color.name}`}
                      name={color.name}
                      hex={color.hex}
                    />
                  ))}
                {!!scan.pairing && (
                  <PaintChip
                    name={scan.pairing.name}
                    hex={scan.pairing.hex}
                    pairing
                  />
                )}
              </View>
              {!!scan.idea && <TipBubble text={scan.idea} />}
            </View>
          )}

          <View
            style={{
              marginHorizontal: 12,
              backgroundColor: colors.ink,
              borderRadius: 32,
              padding: 12,
              paddingTop: 20,
              gap: 12,
              ...shadow(0.25),
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingHorizontal: 8,
                paddingBottom: 2,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.heading,
                  fontSize: 26,
                  color: colors.white,
                }}
              >
                Get it<Text style={{ color: colors.yellow }}>.</Text>
              </Text>
              <Text
                style={{
                  fontFamily: fonts.bold,
                  fontSize: 13,
                  color: "#D9D6E3",
                }}
              >
                {items.length} {items.length === 1 ? "match" : "matches"}
              </Text>
            </View>
            {items.length ? (
              items.map((item, index) => (
                <ShopRow
                  key={`${item.url}-${index}`}
                  item={item}
                  badge={
                    index === 0
                      ? "Best match"
                      : item.price === cheapest
                        ? "Cheapest"
                        : null
                  }
                  saving={
                    item.price !== null &&
                    item.price === cheapest &&
                    priceLow !== undefined &&
                    Number.isFinite(priceLow) &&
                    item.price < priceLow
                      ? Math.floor(priceLow - item.price)
                      : null
                  }
                  disabled={opening >= 0}
                  busy={opening === index}
                  onShop={() => void shop(index)}
                />
              ))
            ) : (
              <View
                style={{
                  minHeight: 88,
                  borderRadius: 22,
                  backgroundColor: colors.white,
                  justifyContent: "center",
                  alignItems: "center",
                  padding: 16,
                }}
              >
                <Body style={{ textAlign: "center" }}>
                  No exact matches yet. Try another photo.
                </Body>
              </View>
            )}
            {!!shopError && (
              <Body style={{ color: colors.white, paddingHorizontal: 8 }}>
                {shopError}
              </Body>
            )}
            <Pressable
              onPress={onScanAnother}
              accessibilityRole="button"
              style={{
                minHeight: 48,
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Icon name="camera" size={20} color={colors.yellow} />
              <Text
                style={{
                  color: colors.white,
                  fontFamily: fonts.bold,
                  fontSize: 15,
                }}
              >
                Scan another piece
              </Text>
            </Pressable>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button
                secondary
                icon="image"
                title="Choose from gallery"
                onPress={onGallery}
                style={{ flex: 1, minHeight: 44, borderRadius: 14 }}
              />
            </View>
          </View>
          {!!error && (
            <Body
              style={{
                marginHorizontal: 20,
                backgroundColor: colors.chip,
                borderRadius: 16,
                padding: 12,
              }}
            >
              {error}
            </Body>
          )}
        </View>
      </ScrollView>

      <View
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          bottom: Math.max(16, insets.bottom) + 76,
          flexDirection: "row",
          gap: 10,
          padding: 10,
          borderRadius: 28,
          backgroundColor: "rgba(255,255,255,0.96)",
          ...shadow(0.16),
        }}
      >
        <TactileButton icon="sparkles" title="Try it on me" onPress={onTryOn} />
        <SaveButton saved={saved} saving={saving} onPress={onSave} />
      </View>
    </View>
  );
}

function Round({
  icon,
  label,
  onPress,
}: {
  icon: "arrow-left" | "share";
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
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
      <Icon name={icon} size={20} />
    </Pressable>
  );
}

function SaveButton({
  saved,
  saving,
  onPress,
}: {
  saved: boolean;
  saving: boolean;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (saved)
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.2, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
      ]).start();
  }, [saved, scale]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Save to Closet"
      accessibilityState={{ checked: saved, disabled: saved || saving }}
      onPress={onPress}
      disabled={saved || saving}
      onPressIn={() => {
        setPressed(true);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
          () => {},
        );
      }}
      onPressOut={() => setPressed(false)}
      style={{
        width: 56,
        height: 56,
        borderRadius: 20,
        borderWidth: 2.5,
        borderColor: colors.ink,
        backgroundColor: saved ? colors.ink : colors.white,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ translateY: pressed ? 4 : 0 }],
        ...shadow(pressed ? 0 : 0.18),
      }}
    >
      {saving ? (
        <ActivityIndicator color={colors.ink} />
      ) : (
        <Animated.View style={{ transform: [{ scale }] }}>
          <Icon
            name={saved ? "heart-filled" : "heart"}
            size={23}
            color={saved ? colors.yellow : colors.ink}
          />
        </Animated.View>
      )}
    </Pressable>
  );
}

function TactileButton({
  icon,
  title,
  onPress,
}: {
  icon: "sparkles";
  title: string;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => {
        setPressed(true);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
          () => {},
        );
      }}
      onPressOut={() => setPressed(false)}
      style={{
        flex: 1,
        height: 56,
        borderRadius: 20,
        borderWidth: 2.5,
        borderColor: colors.ink,
        backgroundColor: colors.yellow,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        transform: [{ translateY: pressed ? 4 : 0 }],
        ...shadow(pressed ? 0 : 0.2),
      }}
    >
      <Icon name={icon} size={21} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 17 }}>{title}</Text>
    </Pressable>
  );
}

function Chip({
  children,
  dark = false,
}: {
  children: string;
  dark?: boolean;
}) {
  return (
    <Text
      style={{
        overflow: "hidden",
        borderRadius: 999,
        paddingHorizontal: 13,
        paddingVertical: 8,
        backgroundColor: dark ? colors.ink : colors.white,
        color: dark ? colors.yellow : colors.ink,
        fontFamily: fonts.bold,
        fontSize: 13,
      }}
    >
      {children}
    </Text>
  );
}

function Tag({ children }: { children: string }) {
  return (
    <StickerBadge size={18} rotate="-3deg">
      {children}
    </StickerBadge>
  );
}

function Sticker({
  children,
  style,
  color,
  textColor,
  delay,
  active,
}: {
  children: string;
  style: object;
  color: string;
  textColor: string;
  delay: number;
  active: boolean;
}) {
  const scale = useRef(new Animated.Value(active ? 0 : 1)).current;
  useEffect(() => {
    if (!active) {
      scale.setValue(1);
      return;
    }
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 11,
        stiffness: 180,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [active, delay, scale]);
  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ rotate: "-4deg" }, { scale }],
          backgroundColor: color,
          borderWidth: 3,
          borderColor: colors.white,
          borderRadius: 14,
          paddingHorizontal: 11,
          paddingVertical: 4,
          ...shadow(0.18),
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={{ fontFamily: fonts.heading, fontSize: 14, color: textColor }}
      >
        {children}
      </Text>
    </Animated.View>
  );
}

function Ping({
  style,
  active,
  delay,
}: {
  style: object;
  active: boolean;
  delay: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      progress.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(progress, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, delay, progress]);
  return (
    <Animated.View
      style={[
        style,
        {
          position: "absolute",
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: colors.yellow,
          opacity: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.75, 0],
          }),
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 2.8],
              }),
            },
          ],
        },
      ]}
    />
  );
}

function MeterBlock({
  filled,
  highlight,
  index,
  animate,
}: {
  filled: boolean;
  highlight: boolean;
  index: number;
  animate: boolean;
}) {
  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.sequence([
      Animated.delay(index * 60),
      Animated.timing(progress, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [animate, index, progress]);
  return (
    <View
      style={{
        flex: 1,
        height: 16,
        borderRadius: 5,
        backgroundColor: filled ? colors.ink : "#E7E2D3",
        borderWidth: highlight ? 2.5 : 0,
        borderColor: colors.ink,
        overflow: "hidden",
      }}
    >
      <Animated.View
        style={{
          flex: 1,
          borderRadius: 3,
          backgroundColor: highlight ? colors.yellow : colors.ink,
          opacity: progress,
          transform: [
            {
              scaleY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.2, 1],
              }),
            },
          ],
        }}
      />
    </View>
  );
}

function VerdictTile({
  title,
  item,
}: {
  title: string;
  item: NonNullable<Scan["verdicts"]>["style"];
}) {
  const [bg, fg] = statusColors[item.status];
  return (
    <View
      style={{
        flex: 1,
        minHeight: 112,
        backgroundColor: colors.white,
        borderRadius: 20,
        padding: 12,
        gap: 6,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.bold,
          fontSize: 11,
          letterSpacing: 1,
          color: colors.text3,
        }}
      >
        {title}
      </Text>
      <Text
        numberOfLines={1}
        style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink }}
      >
        {item.value}
      </Text>
      <View
        style={{
          alignSelf: "flex-start",
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 4,
          backgroundColor: bg,
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
        }}
      >
        {item.status === "good" && <Icon name="check" size={14} color={fg} />}
        <Text style={{ color: fg, fontFamily: fonts.bold, fontSize: 12 }}>
          {item.label}
        </Text>
      </View>
    </View>
  );
}

function DetailTile({
  detail,
  index,
}: {
  detail: Scan["details"][number];
  index: number;
}) {
  const icon =
    detail.type === "fabric"
      ? "layers"
      : detail.type === "fit"
        ? "maximize"
        : detail.type === "collar"
          ? "shirt"
          : detail.type === "graphic"
            ? "type"
            : "sparkles";
  return (
    <LinearGradient
      colors={tileColors[index % tileColors.length]!}
      style={{
        width: 138,
        height: 150,
        borderRadius: 24,
        borderWidth: 4,
        borderColor: colors.white,
        padding: 14,
        justifyContent: "space-between",
        ...shadow(0.08),
      }}
    >
      <Icon name={icon} size={28} />
      <View style={{ gap: 4 }}>
        <Text
          style={{
            fontFamily: fonts.bold,
            fontSize: 11,
            letterSpacing: 1,
            color: colors.text2,
            textTransform: "uppercase",
          }}
        >
          {detail.label}
        </Text>
        <Text
          numberOfLines={3}
          style={{
            fontFamily: fonts.bold,
            fontSize: 15,
            lineHeight: 19,
            color: colors.ink,
          }}
        >
          {detail.value}
        </Text>
      </View>
    </LinearGradient>
  );
}

function PaintChip({
  name,
  hex,
  pairing = false,
}: {
  name: string;
  hex: string;
  pairing?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        height: 122,
        backgroundColor: colors.white,
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: pairing ? 2 : 0,
        borderColor: colors.ink,
        ...shadow(0.08),
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: hex,
          borderBottomWidth: name.toLowerCase() === "white" && !pairing ? 1 : 0,
          borderBottomColor: "#EEEAE0",
          overflow: "hidden",
        }}
      >
        {pairing && (
          <>
            {[0, 1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={{
                  position: "absolute",
                  width: "150%",
                  height: 18,
                  left: -15,
                  top: i * 35,
                  backgroundColor: "rgba(20,18,31,0.12)",
                  transform: [{ rotate: "-35deg" }],
                }}
              />
            ))}
            <StickerBadge
              size={16}
              color={colors.yellow}
              rotate="5deg"
              style={{ position: "absolute", top: 8, right: 6 }}
            >
              Tip
            </StickerBadge>
          </>
        )}
      </View>
      <View style={{ paddingHorizontal: 10, paddingVertical: 8, gap: 1 }}>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.bold, fontSize: 14 }}
        >
          {name}
        </Text>
        <Text
          style={{ color: colors.text3, fontFamily: fonts.body, fontSize: 12 }}
        >
          {pairing ? "Pairs with" : hex.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

function TipBubble({ text }: { text: string }) {
  const clean = text.replace(/^💡\s*/, "");
  return (
    <View
      style={{
        backgroundColor: colors.ink,
        borderRadius: 20,
        borderBottomLeftRadius: 6,
        padding: 14,
        flexDirection: "row",
        flexWrap: "wrap",
      }}
    >
      <Text
        style={{ color: colors.yellow, fontFamily: fonts.bold, fontSize: 14 }}
      >
        Style tip:{" "}
      </Text>
      <Text
        style={{
          flex: 1,
          color: colors.white,
          fontFamily: fonts.body,
          fontSize: 14,
          lineHeight: 20,
        }}
      >
        {clean}
      </Text>
    </View>
  );
}

function ShopRow({
  item,
  badge,
  saving,
  disabled,
  busy,
  onShop,
}: {
  item: Lookalike;
  badge: string | null;
  saving: number | null;
  disabled: boolean;
  busy: boolean;
  onShop: () => void;
}) {
  return (
    <View
      style={{
        position: "relative",
        minHeight: 120,
        backgroundColor: colors.white,
        borderRadius: 24,
        padding: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <Image
        source={{ uri: item.image }}
        contentFit="cover"
        accessibilityLabel={item.title}
        style={{
          width: 84,
          height: 100,
          borderRadius: 16,
          backgroundColor: "#F4F2EC",
        }}
      />
      <View
        style={{
          flex: 1,
          minWidth: 0,
          alignSelf: "stretch",
          justifyContent: "center",
          gap: 4,
        }}
      >
        {!!badge && (
          <Text
            style={{
              alignSelf: "flex-start",
              overflow: "hidden",
              borderRadius: 999,
              paddingHorizontal: 8,
              paddingVertical: 3,
              backgroundColor: badge === "Cheapest" ? "#127A55" : colors.ink,
              color: colors.white,
              fontFamily: fonts.bold,
              fontSize: 11,
            }}
          >
            {badge}
          </Text>
        )}
        <Text
          numberOfLines={2}
          style={{
            fontFamily: fonts.medium,
            fontSize: 13,
            lineHeight: 17,
            color: colors.ink,
          }}
        >
          {item.title}
        </Text>
        <Text
          numberOfLines={1}
          style={{ color: colors.text3, fontFamily: fonts.body, fontSize: 12 }}
        >
          {item.store}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 8 }}>
        <Text style={{ fontFamily: fonts.heading, fontSize: 20 }}>
          {item.price === null ? "See price" : `$${item.price.toFixed(2)}`}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Shop at ${item.store}`}
          disabled={disabled}
          onPress={onShop}
          style={{
            minWidth: 72,
            minHeight: 44,
            borderRadius: 14,
            backgroundColor: colors.yellow,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 6,
            paddingHorizontal: 10,
          }}
        >
          <Icon name="shopping-bag" size={16} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 14 }}>
            {busy ? "Opening" : "Shop"}
          </Text>
        </Pressable>
      </View>
      {saving !== null && (
        <StickerBadge
          size={17}
          rotate="5deg"
          style={{ position: "absolute", right: 10, top: -10 }}
        >
          ${saving} under typical
        </StickerBadge>
      )}
    </View>
  );
}
