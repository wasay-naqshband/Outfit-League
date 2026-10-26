import React, { useEffect, useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Body, Button, Heading, Icon, RoundButton } from "../src/components/ui";
import { colors, fonts, gradients, shadow } from "../src/theme";
import { useWallet } from "../src/lib/queries";
import { useApp } from "../src/lib/state";
import { analytics } from "../src/lib/analytics";
import {
  buyPackage,
  getPurchaseOptions,
  identifyPurchasesUser,
  purchasesAvailable,
  restorePurchases,
  TRYON_PACK_CREDITS,
  type PurchaseOptions,
} from "../src/lib/revenuecat";

type Plan = "yearly" | "monthly" | "pack";
const emptyOffers: PurchaseOptions = {
  yearly: null,
  monthly: null,
  pack: null,
};

export default function Paywall() {
  const insets = useSafeAreaInsets();
  const { session } = useApp();
  const wallet = useWallet();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const exhausted = source === "credits";
  const close = () => router.replace("/(tabs)");
  const [offers, setOffers] = useState<PurchaseOptions>(emptyOffers);
  const [selected, setSelected] = useState<Plan>("yearly");
  const [loading, setLoading] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState("");

  useEffect(() => {
    analytics.track("paywall_opened", {
      source: source === "credits" || source === "feature" ? source : "direct",
    });
  }, [source]);
  useEffect(() => {
    if (!purchasesAvailable() || !session) return;
    void identifyPurchasesUser(session.user.id)
      .then(getPurchaseOptions)
      .then((next) => {
        setOffers(next);
        if (!next.yearly && next.monthly) setSelected("monthly");
        else if (!next.yearly && !next.monthly && next.pack)
          setSelected("pack");
      })
      // Apple's own reason (e.g. products or the Paid Apps agreement not ready)
      // so a setup problem can be told apart from a network blip.
      .catch((e: { message?: string }) =>
        setPurchaseMessage(
          `App Store offers couldn’t load. ${e?.message ?? "Please try again."}`,
        ),
      );
  }, [session?.user.id]);

  const packageFor = (plan: Plan) => offers[plan];
  const selectedPackage = offers[selected];
  const price = (plan: Plan, fallback: string) =>
    packageFor(plan)?.product.priceString ?? fallback;

  async function refreshUntilConfirmed(plan: Plan, previousBalance: number) {
    for (let attempt = 0; attempt < 15; attempt += 1) {
      const result = await wallet.refetch();
      const current = result.data;
      if (
        current &&
        (plan === "pack"
          ? current.available >= previousBalance + TRYON_PACK_CREDITS
          : current.subscription_active && current.subscription_tryons >= 1)
      )
        return true;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    return false;
  }

  // Already on paid Pro: only the try-on pack is worth buying here.
  const onPro =
    !!wallet.data?.subscription_active && !wallet.data.subscription_trial;
  const ownedPlan = onPro && selected !== "pack";
  async function purchase() {
    if (!selectedPackage || loading || ownedPlan) return;
    const previousBalance = wallet.data?.available ?? 0;
    setLoading(true);
    setPurchaseMessage("");
    try {
      await buyPackage(selectedPackage);
      analytics.track("purchase_completed", { plan: selected });
      const confirmed = await refreshUntilConfirmed(selected, previousBalance);
      if (confirmed) {
        setPurchaseMessage("Your Outfit League plan is ready.");
        await wallet.refetch();
      } else {
        setPurchaseMessage(
          "Apple confirmed your purchase. Your benefits are syncing; check again shortly.",
        );
      }
    } catch (e) {
      // Closing Apple's sheet isn't an error.
      if ((e as { userCancelled?: boolean })?.userCancelled) return;
      analytics.track("purchase_failed", { plan: selected });
      setPurchaseMessage(
        "We couldn’t confirm the purchase. Check your App Store account before trying again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function restore() {
    if (loading || !purchasesAvailable()) return;
    setLoading(true);
    setPurchaseMessage("");
    try {
      await restorePurchases();
      await wallet.refetch();
      setPurchaseMessage(
        "Purchases restored. Your server balance has been refreshed.",
      );
    } catch {
      setPurchaseMessage("We couldn’t restore purchases. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const plans: {
    id: Plan;
    title: string;
    description: string;
    fallback: string;
    featured?: boolean;
  }[] = [
    {
      id: "yearly",
      title: "Pro yearly",
      description:
        "40 try-ons + 5 360° views each month · $6.67/month · save 33%",
      fallback: "$79.99",
      featured: true,
    },
    {
      id: "monthly",
      title: "Pro monthly",
      description: "40 try-ons + 5 360° views each month",
      fallback: "$9.99",
    },
    {
      id: "pack",
      title: "Try-on pack",
      description: "15 try-ons · one-time purchase · credits never expire",
      fallback: "$4.99",
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 36 }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={gradients.yellow}
          style={{
            paddingTop: insets.top + 16,
            paddingHorizontal: 20,
            paddingBottom: 26,
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
            gap: 18,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <RoundButton
              name="x"
              label="Close and keep browsing"
              onPress={close}
            />
          </View>
          <View style={{ gap: 8 }}>
            <Heading size={32} style={{ letterSpacing: -1.1 }}>
              {exhausted
                ? "Your free try-ons are all used."
                : "See it on you before you buy."}
            </Heading>
            <Body style={{ fontFamily: fonts.medium, color: "#3B3647" }}>
              Keep exploring with Free, or choose the plan that fits your style.
            </Body>
          </View>
        </LinearGradient>

        <View style={{ padding: 20, gap: 12 }}>
          <Body
            style={{
              fontFamily: fonts.bold,
              color: colors.ink,
              marginBottom: 2,
            }}
          >
            Choose your plan
          </Body>
          {plans.map((plan) => {
            const active = selected === plan.id;
            return (
              <Pressable
                key={plan.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => setSelected(plan.id)}
                style={{
                  backgroundColor: active ? "#FFF4A8" : colors.white,
                  borderColor: active ? colors.ink : "#E6E0D2",
                  borderWidth: active ? 2 : 1,
                  borderRadius: 22,
                  padding: 16,
                  gap: 7,
                  ...shadow(active ? 0.08 : 0.03),
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      flex: 1,
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor: active ? colors.ink : colors.inactive,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {active && (
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: colors.ink,
                          }}
                        />
                      )}
                    </View>
                    <Heading size={20}>{plan.title}</Heading>
                  </View>
                  {plan.featured && (
                    <Text
                      style={{
                        color: colors.ink,
                        backgroundColor: colors.yellow,
                        fontFamily: fonts.bold,
                        fontSize: 11,
                        paddingHorizontal: 9,
                        paddingVertical: 5,
                        borderRadius: 12,
                      }}
                    >
                      BEST VALUE
                    </Text>
                  )}
                </View>
                <Body style={{ marginLeft: 30, fontSize: 14 }}>
                  {plan.description}
                </Body>
                <Text
                  style={{
                    marginLeft: 30,
                    color: colors.ink,
                    fontFamily: fonts.bold,
                    fontSize: 17,
                  }}
                >
                  {price(plan.id, plan.fallback)}
                  {plan.id === "monthly"
                    ? " / month"
                    : plan.id === "yearly"
                      ? " / year"
                      : ""}
                </Text>
              </Pressable>
            );
          })}

          <View
            style={{
              backgroundColor: colors.white,
              borderRadius: 22,
              padding: 16,
              gap: 8,
              marginTop: 2,
            }}
          >
            <Heading size={19}>Free is always yours</Heading>
            <Body style={{ fontSize: 14 }}>
              Three try-ons to start, plus the stylist and battles. Browse and
              save inspiration on Free or Pro.
            </Body>
          </View>

          <View style={{ gap: 8, marginTop: 2 }}>
            {[
              "Pro: store links and 5 included 360° views each month",
              "Free trials include try-ons; 360° views start with paid Pro",
              "One credit for each successful garment try-on",
              "Failed generations return the reserved credits",
              "Your try-on photo stays private",
            ].map((benefit) => (
              <View
                key={benefit}
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <Icon name="check" size={18} color="#127A55" />
                <Body style={{ flex: 1, color: colors.ink, fontSize: 14 }}>
                  {benefit}
                </Body>
              </View>
            ))}
          </View>

          <Button
            title={
              loading
                ? "Connecting to Apple…"
                : ownedPlan
                  ? "You’re on Pro ✓"
                  : selectedPackage
                    ? `Continue · ${price(selected, selected === "yearly" ? "$79.99/year" : selected === "monthly" ? "$9.99/month" : "$4.99")}`
                    : purchasesAvailable()
                      ? "This offer is being set up"
                      : "Purchases aren’t configured yet"
            }
            disabled={!selectedPackage || loading || ownedPlan}
            style={{ minHeight: 60, borderRadius: 22, marginTop: 4 }}
            onPress={() => void purchase()}
          />
          {Platform.OS === "ios" &&
            process.env.EXPO_PUBLIC_APPLE_SANDBOX_TESTING === "true" && (
              <Body style={{ textAlign: "center", fontSize: 13 }}>
                TestFlight sandbox purchase · Apple won’t charge you.
              </Body>
            )}
          <Body style={{ textAlign: "center", fontSize: 13 }}>
            {purchaseMessage ||
              (selected === "monthly"
                ? "Renews monthly at the App Store price. Any introductory offer and eligibility will be shown by Apple before purchase. A free trial includes try-ons only. Cancel in Apple settings."
                : selected === "yearly"
                  ? "Billed yearly. 40 try-ons and 5 included 360° views refresh monthly; unused monthly allowances expire."
                  : "One-time App Store purchase. Purchased try-ons never expire.")}
          </Body>

          <Pressable
            accessibilityRole="button"
            disabled={loading || !purchasesAvailable()}
            onPress={() => void restore()}
            style={{
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: colors.ink,
                fontFamily: fonts.medium,
                textDecorationLine: "underline",
              }}
            >
              Restore purchases
            </Text>
          </Pressable>
          <View
            style={{ flexDirection: "row", justifyContent: "center", gap: 28 }}
          >
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push("/terms")}
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
          <Pressable
            accessibilityRole="button"
            onPress={close}
            style={{
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Body style={{ color: colors.ink, fontFamily: fonts.bold }}>
              Continue with Free · keep browsing
            </Body>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
