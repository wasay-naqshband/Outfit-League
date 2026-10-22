import React, { useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Body,
  Button,
  Heading,
  Icon,
  RoundButton,
  StickerBadge,
} from "../src/components/ui";
import { colors, fonts, gradients, shadow } from "../src/theme";

type Plan = {
  id: "pro_monthly" | "tryon_pack";
  price: string; // store-localised, never hard-coded
  trialDays?: number;
  credits?: number;
};
// ponytail: no store is connected yet, so there is nothing to sell. Wire
// RevenueCat/StoreKit products here; everything below renders from them.
const storePlans: Plan[] = [];
// Development-only preview of the layout with placeholder products.
const samplePlans: Plan[] = [
  { id: "pro_monthly", price: "PKR [price]", trialDays: 3 },
  { id: "tryon_pack", price: "PKR [price]", credits: 10 },
];
const BENEFITS = [
  "A fresh bundle of AI try-ons every month",
  "Try on anything from any store link",
  "360° views of your favourite looks",
];

export default function Paywall() {
  const insets = useSafeAreaInsets();
  const { preview } = useLocalSearchParams<{
    source?: string;
    preview?: string;
  }>();
  const plans = __DEV__ && preview ? samplePlans : storePlans;
  const [selected, setSelected] = useState<Plan["id"]>("pro_monthly");
  const pro = plans.find((p) => p.id === "pro_monthly");
  const pack = plans.find((p) => p.id === "tryon_pack");
  const plan = plans.find((p) => p.id === selected);
  const trial = selected === "pro_monthly" ? pro?.trialDays : undefined;
  const close = () => router.replace("/(tabs)");
  const unavailable = () =>
    Alert.alert(
      "Not available yet",
      "Purchases aren’t connected yet. Your free try-ons still work.",
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={gradients.yellow}
          style={{
            paddingTop: insets.top + 20,
            paddingHorizontal: 20,
            paddingBottom: 26,
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
            gap: 18,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Pressable
              accessibilityRole="button"
              onPress={unavailable}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>
                Restore
              </Text>
            </Pressable>
            <RoundButton name="x" label="Close" onPress={close} />
          </View>
          <View style={{ gap: 8 }}>
            <Heading size={32} style={{ letterSpacing: -1.1 }}>
              Stop guessing. See it on you first.
            </Heading>
            <Body style={{ fontFamily: fonts.medium, color: "#3B3647" }}>
              Your fitting room is ready.
            </Body>
          </View>
        </LinearGradient>
        <View style={{ padding: 20, gap: 16 }}>
          {!!trial && (
            <View
              style={{
                flexDirection: "row",
                backgroundColor: colors.white,
                borderRadius: 28,
                paddingVertical: 20,
                ...shadow(0.06),
              }}
            >
              {(
                [
                  ["sparkles", "Today", "Full Pro access", true],
                  ["clock", `Day ${trial - 1}`, "We remind you", true],
                  ["check", `Day ${trial}`, "Trial ends", false],
                ] as const
              ).map(([icon, day, text, dark]) => (
                <View
                  key={day}
                  style={{ flex: 1, alignItems: "center", gap: 6 }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: dark ? colors.ink : "#ECE7DD",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon
                      name={icon}
                      size={18}
                      color={dark ? colors.yellow : colors.ink}
                    />
                  </View>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>
                    {day}
                  </Text>
                  <Body style={{ fontSize: 14 }}>{text}</Body>
                </View>
              ))}
            </View>
          )}
          <View style={{ gap: 10 }}>
            {BENEFITS.map((benefit) => (
              <View
                key={benefit}
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <Icon name="check" size={20} color="#127A55" />
                <Body style={{ flex: 1, color: colors.ink, fontSize: 17 }}>
                  {benefit}
                </Body>
              </View>
            ))}
          </View>
          {(
            [
              [
                "pro_monthly",
                "Pro monthly",
                pro
                  ? pro.trialDays
                    ? `${pro.trialDays} days free, then ${pro.price}/month`
                    : `${pro.price}/month`
                  : "Monthly subscription",
              ],
              [
                "tryon_pack",
                "Try-on pack",
                pack
                  ? `${pack.price} for ${pack.credits} try-ons · no subscription`
                  : "One-time credits · no subscription",
              ],
            ] as const
          ).map(([id, title, subtitle]) => {
            const on = selected === id;
            return (
              <Pressable
                key={id}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => setSelected(id)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  padding: 18,
                  borderRadius: 24,
                  borderWidth: 2.5,
                  borderColor: on ? colors.ink : "transparent",
                  backgroundColor: on ? "#FFF6B8" : colors.white,
                  marginTop: id === "pro_monthly" ? 8 : 0,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    borderWidth: on ? 9 : 2,
                    borderColor: on ? colors.ink : "#CFCAD9",
                    backgroundColor: colors.white,
                  }}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 19 }}>
                    {title}
                  </Text>
                  <Body style={{ fontSize: 15 }}>{subtitle}</Body>
                </View>
                {id === "pro_monthly" && (
                  <StickerBadge
                    rotate="4deg"
                    style={{ position: "absolute", right: 14, top: -18 }}
                  >
                    Most popular
                  </StickerBadge>
                )}
              </Pressable>
            );
          })}
          <Button
            icon="sparkles"
            title={
              !plan
                ? "Purchases open soon"
                : selected === "tryon_pack"
                  ? `Buy ${plan.credits} try-ons`
                  : trial
                    ? "Start my free trial"
                    : "Subscribe"
            }
            disabled={!plan}
            style={{ minHeight: 60, borderRadius: 22 }}
            onPress={unavailable}
          />
          <Body style={{ textAlign: "center", fontSize: 14 }}>
            {!plan
              ? "Payments aren’t connected yet. Your free try-ons still work."
              : selected === "tryon_pack"
                ? "One-time purchase. No subscription."
                : trial
                  ? "No charge today. Cancel anytime in Settings."
                  : `${plan.price}/month. Cancel anytime.`}
          </Body>
          <View
            style={{ flexDirection: "row", justifyContent: "center", gap: 28 }}
          >
            <Pressable
              accessibilityRole="link"
              onPress={() =>
                void Linking.openURL(
                  "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/",
                )
              }
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Body>Terms</Body>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push("/privacy")}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Body>Privacy</Body>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
