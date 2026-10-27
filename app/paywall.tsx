import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Feather from "@expo/vector-icons/Feather";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Body, Heading, Icon } from "../src/components/ui";
import { useApp } from "../src/lib/state";
import { useWallet } from "../src/lib/queries";
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
import { colors, fonts, gradients, shadow } from "../src/theme";

type Plan = "yearly" | "monthly" | "pack";
const emptyOffers: PurchaseOptions = {
  yearly: null,
  monthly: null,
  pack: null,
};
const ink = colors.ink;
const green = "#127A55";

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return value.toFixed(2);
  }
}

function Tag({ children, style }: { children: string; style?: object }) {
  return (
    <View
      style={[
        {
          backgroundColor: "#FF9BD2",
          borderColor: "white",
          borderWidth: 3,
          borderRadius: 18,
          paddingHorizontal: 12,
          paddingVertical: 6,
          transform: [{ rotate: "-4deg" }],
        },
        style,
      ]}
    >
      <Text style={{ fontFamily: fonts.heading, color: ink, fontSize: 13 }}>
        {children}
      </Text>
    </View>
  );
}

function Check({ included }: { included: boolean }) {
  return included ? (
    <Feather name="check" size={19} color={green} />
  ) : (
    <Text
      accessibilityLabel="Not included"
      style={{ color: "#B5B0A2", fontSize: 18 }}
    >
      —
    </Text>
  );
}

export default function Paywall() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 375;
  const { session } = useApp();
  const wallet = useWallet();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const exhausted = source === "credits";
  const close = () => router.replace("/(tabs)");
  const [offers, setOffers] = useState<PurchaseOptions>(emptyOffers);
  const [selected, setSelected] = useState<Plan>("yearly");
  const [loading, setLoading] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const [offersLoading, setOffersLoading] = useState(true);

  useEffect(() => {
    analytics.track("paywall_opened", {
      source: source === "credits" || source === "feature" ? source : "direct",
    });
  }, [source]);

  useEffect(() => {
    let active = true;
    if (!purchasesAvailable() || !session) {
      setOffersLoading(false);
      return;
    }
    setOffersLoading(true);
    void identifyPurchasesUser(session.user.id)
      .then(getPurchaseOptions)
      .then((next) => {
        if (!active) return;
        setOffers(next);
        if (!next.yearly && next.monthly) setSelected("monthly");
        else if (!next.yearly && !next.monthly && next.pack)
          setSelected("pack");
      })
      .catch((e: { message?: string }) => {
        if (active)
          setPurchaseMessage(
            `App Store offers couldn’t load. ${e?.message ?? "Please try again."}`,
          );
      })
      .finally(() => active && setOffersLoading(false));
    return () => {
      active = false;
    };
  }, [session?.user.id]);

  const packageFor = (plan: Plan) => offers[plan];
  const selectedPackage = packageFor(selected);
  const price = (plan: Plan) => packageFor(plan)?.product.priceString ?? "";
  const priceValue = (plan: Plan) => packageFor(plan)?.product.price ?? null;
  const currency = (plan: Plan) =>
    packageFor(plan)?.product.currencyCode ?? "USD";
  const yearlyValue = priceValue("yearly");
  const monthlyValue = priceValue("monthly");
  const perMonth =
    yearlyValue == null
      ? ""
      : formatCurrency(yearlyValue / 12, currency("yearly"));
  const savings =
    yearlyValue != null && monthlyValue != null && monthlyValue > 0
      ? Math.round((1 - yearlyValue / (monthlyValue * 12)) * 100)
      : null;

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
      setPurchaseMessage(
        confirmed
          ? "Your Outfit League plan is ready."
          : "Apple confirmed your purchase. Your benefits are syncing; check again shortly.",
      );
      if (confirmed) await wallet.refetch();
    } catch (e) {
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

  const proPerMonth = (plan: Plan) =>
    plan === "yearly" ? perMonth : price(plan);
  const selectPlan = (plan: Plan) => {
    void Haptics.selectionAsync();
    setSelected(plan);
    setPurchaseMessage("");
  };

  const planRows: {
    id: Plan;
    title: string;
    detail: string;
    period: string;
    featured?: boolean;
  }[] = [
    {
      id: "yearly",
      title: "Pro yearly",
      detail: "40 try-ons + 5 360° views each month",
      period: "/month",
      featured: true,
    },
    {
      id: "monthly",
      title: "Pro monthly",
      detail: "40 try-ons + 5 360° views each month",
      period: "/month",
    },
    {
      id: "pack",
      title: "Try-on pack",
      detail: "15 try-ons · one-time · never expire",
      period: "",
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 154 }}
      >
        <LinearGradient
          colors={["#FFF7A8", colors.yellow, "#FFDD1F"]}
          locations={[0, 0.6, 1]}
          style={{
            paddingTop: insets.top + 10,
            paddingHorizontal: 20,
            paddingBottom: 32,
            borderBottomLeftRadius: 36,
            borderBottomRightRadius: 36,
            ...shadow(0.1),
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Heading size={18}>Outfit League</Heading>
              <View
                style={{
                  backgroundColor: ink,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 9,
                  transform: [{ rotate: "-4deg" }],
                }}
              >
                <Text
                  style={{
                    color: colors.yellow,
                    fontFamily: fonts.bold,
                    fontSize: 12,
                  }}
                >
                  PRO
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={close}
              style={{
                width: 44,
                height: 44,
                borderRadius: 24,
                backgroundColor: "white",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="x" size={22} />
            </Pressable>
          </View>

          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              height: 190,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: compact ? 4 : 8,
              marginTop: 10,
            }}
          >
            <LinearGradient
              colors={gradients.lavender}
              style={{
                width: compact ? 96 : 108,
                height: 142,
                borderWidth: 4,
                borderColor: "white",
                borderRadius: 24,
                padding: 10,
                justifyContent: "space-between",
                transform: [{ rotate: "-7deg" }],
              }}
            >
              <Icon name="sparkles" size={22} />
              <View>
                <Text
                  style={{
                    fontFamily: fonts.heading,
                    fontSize: 36,
                    lineHeight: 40,
                    color: ink,
                  }}
                >
                  40
                </Text>
                <Text
                  style={{ fontFamily: fonts.bold, fontSize: 12, color: ink }}
                >
                  try-ons every month
                </Text>
              </View>
            </LinearGradient>
            <View
              style={{
                width: compact ? 112 : 124,
                height: 158,
                borderWidth: 4,
                borderColor: "white",
                borderRadius: 24,
                padding: 12,
                backgroundColor: ink,
                justifyContent: "space-between",
                transform: [{ rotate: "2deg" }],
                zIndex: 1,
              }}
            >
              <Icon name="refresh-cw" size={22} color={colors.yellow} />
              <View>
                <Text
                  style={{
                    fontFamily: fonts.heading,
                    fontSize: 32,
                    lineHeight: 36,
                    color: colors.yellow,
                  }}
                >
                  360°
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.bold,
                    fontSize: 12,
                    lineHeight: 16,
                    color: "white",
                  }}
                >
                  5 spin-around views a month
                </Text>
              </View>
            </View>
            <LinearGradient
              colors={gradients.mint}
              style={{
                width: compact ? 96 : 108,
                height: 138,
                borderWidth: 4,
                borderColor: "white",
                borderRadius: 24,
                padding: 10,
                justifyContent: "space-between",
                transform: [{ rotate: "7deg" }],
              }}
            >
              <Icon name="shopping-bag" size={22} />
              <View>
                <Text
                  style={{
                    fontFamily: fonts.heading,
                    fontSize: 18,
                    lineHeight: 20,
                    color: ink,
                  }}
                >
                  Store links
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.bold,
                    fontSize: 12,
                    lineHeight: 15,
                    color: ink,
                  }}
                >
                  Shop what you try
                </Text>
              </View>
            </LinearGradient>
            <Tag
              style={{
                position: "absolute",
                zIndex: 2,
                top: 0,
                right: compact ? 40 : 54,
              }}
            >
              Pro only
            </Tag>
          </View>
          <Heading
            size={compact ? 32 : 34}
            style={{ letterSpacing: -1.3, marginTop: 12 }}
          >
            See it on you before you buy.
          </Heading>
          <Body
            style={{
              color: "#3B3647",
              fontFamily: fonts.medium,
              fontSize: 15,
              lineHeight: 21,
              marginTop: 8,
            }}
          >
            Keep exploring free, or go Pro for way more try-ons.
          </Body>
        </LinearGradient>

        <View style={{ paddingHorizontal: 20, paddingTop: 24, gap: 12 }}>
          <Heading size={22}>Choose your plan</Heading>
          {planRows.map((plan) => {
            const active = selected === plan.id;
            const loadedPrice = price(plan.id);
            const planPrice =
              loadedPrice || (offersLoading ? "Loading…" : "Unavailable");
            return (
              <Pressable
                key={plan.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${plan.title}, ${loadedPrice || (offersLoading ? "price loading" : "price unavailable")}${plan.id === "yearly" && perMonth ? `, ${perMonth} per month${savings != null && savings > 0 ? `, save ${savings}%` : ""}` : ""}${active ? ", selected" : ""}`}
                onPress={() => selectPlan(plan.id)}
                style={{
                  backgroundColor: active
                    ? "#FFF6B8"
                    : plan.id === "pack"
                      ? "transparent"
                      : "white",
                  borderColor: active ? ink : "transparent",
                  borderWidth: active ? 2.5 : plan.id === "pack" ? 2 : 1,
                  borderStyle:
                    plan.id === "pack" && !active ? "dashed" : "solid",
                  borderRadius: 24,
                  padding: 16,
                  paddingTop: plan.featured ? 22 : 16,
                  minHeight: 106,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  ...shadow(active ? 0.07 : 0.03),
                }}
              >
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 14,
                    borderWidth: active ? 7 : 2,
                    borderColor: active ? ink : "#CFCAD9",
                    flexShrink: 0,
                  }}
                />
                <View style={{ flex: 1, gap: 5 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 6,
                    }}
                  >
                    <Heading size={plan.id === "pack" ? 18 : 20}>
                      {plan.title}
                    </Heading>
                    {plan.featured && savings != null && savings > 0 && (
                      <Text
                        style={{
                          overflow: "hidden",
                          borderRadius: 12,
                          backgroundColor: green,
                          color: "white",
                          fontFamily: fonts.bold,
                          fontSize: 11,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                        }}
                      >
                        Save {savings}%
                      </Text>
                    )}
                  </View>
                  <Body style={{ fontSize: 13, lineHeight: 18 }}>
                    {plan.detail}
                  </Body>
                  {plan.id === "yearly" && perMonth ? (
                    <Text
                      style={{
                        color: ink,
                        fontFamily: fonts.heading,
                        fontSize: 18,
                      }}
                    >
                      {perMonth}
                      <Text
                        style={{
                          fontFamily: fonts.medium,
                          fontSize: 13,
                          color: colors.text2,
                        }}
                      >
                        {" "}
                        /month
                      </Text>
                    </Text>
                  ) : null}
                </View>
                <View style={{ alignItems: "flex-end", minWidth: 72 }}>
                  {plan.featured && (
                    <Tag
                      style={{
                        position: "absolute",
                        bottom: 35,
                        right: -10,
                        zIndex: 1,
                      }}
                    >
                      Best value
                    </Tag>
                  )}
                  <Text
                    style={{
                      fontFamily: fonts.heading,
                      fontSize: 19,
                      color: ink,
                      textAlign: "right",
                    }}
                  >
                    {planPrice}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.medium,
                      fontSize: 12,
                      color: colors.text2,
                    }}
                  >
                    {plan.id === "yearly" ? "/year" : plan.period}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              marginVertical: 3,
            }}
          >
            <View style={{ height: 1, flex: 1, backgroundColor: "#E9E3D4" }} />
            <Text
              style={{
                color: colors.text3,
                fontFamily: fonts.bold,
                letterSpacing: 1,
                fontSize: 11,
              }}
            >
              OR JUST TOP UP
            </Text>
            <View style={{ height: 1, flex: 1, backgroundColor: "#E9E3D4" }} />
          </View>

          <View style={{ gap: 14, marginTop: 4 }}>
            <Heading size={22}>Why people go Pro</Heading>
            <LinearGradient
              colors={["#E9FBF2", "#A9E6CC"]}
              style={{
                minHeight: 150,
                borderRadius: 26,
                borderWidth: 4,
                borderColor: "white",
                padding: 15,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                ...shadow(0.08),
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: green,
                    fontFamily: fonts.bold,
                    fontSize: 11,
                    letterSpacing: 1,
                  }}
                >
                  SCAN + SHOP
                </Text>
                <Heading size={20} style={{ marginTop: 4 }}>
                  Spot it. Find it for less.
                </Heading>
                <Body style={{ fontSize: 13, lineHeight: 18, marginTop: 5 }}>
                  Exact matches, similar styles and cheaper lookalikes, with
                  links.
                </Body>
              </View>
              <View style={{ width: 112, alignItems: "center", gap: 6 }}>
                <Image
                  source={require("../assets/paywall-sample-product.jpg")}
                  resizeMode="cover"
                  style={{
                    width: 94,
                    height: 88,
                    borderRadius: 16,
                    transform: [{ rotate: "4deg" }],
                  }}
                />
                <Text
                  style={{
                    textDecorationLine: "line-through",
                    color: colors.text3,
                    fontSize: 11,
                  }}
                >
                  $35–70
                </Text>
                <Text
                  style={{
                    backgroundColor: colors.yellow,
                    borderRadius: 14,
                    paddingHorizontal: 8,
                    paddingVertical: 5,
                    fontFamily: fonts.bold,
                    fontSize: 11,
                  }}
                >
                  Found $14.99
                </Text>
              </View>
            </LinearGradient>
            <LinearGradient
              colors={["#F1EEFF", "#B9ACFF"]}
              style={{
                minHeight: 150,
                borderRadius: 26,
                borderWidth: 4,
                borderColor: "white",
                padding: 15,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                ...shadow(0.08),
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: "#524A83",
                    fontFamily: fonts.bold,
                    fontSize: 11,
                    letterSpacing: 1,
                  }}
                >
                  STYLE COMPANION
                </Text>
                <Heading size={20} style={{ marginTop: 4 }}>
                  A stylist in your pocket.
                </Heading>
                <Body style={{ fontSize: 13, lineHeight: 18, marginTop: 5 }}>
                  Say where you’re going. It builds the fit and shows it on you.
                </Body>
              </View>
              <View style={{ width: 116, gap: 7 }}>
                <Text
                  style={{
                    backgroundColor: ink,
                    color: "white",
                    fontFamily: fonts.medium,
                    fontSize: 11,
                    padding: 8,
                    borderRadius: 14,
                    overflow: "hidden",
                    alignSelf: "flex-end",
                  }}
                >
                  Date night tmrw?
                </Text>
                <Text
                  style={{
                    backgroundColor: colors.yellow,
                    color: ink,
                    fontFamily: fonts.bold,
                    fontSize: 11,
                    padding: 8,
                    borderRadius: 14,
                    overflow: "hidden",
                  }}
                >
                  Black knit + wide-leg pants. Try it on?
                </Text>
                <Text style={{ color: ink, fontSize: 15 }}>•••</Text>
              </View>
            </LinearGradient>
            <LinearGradient
              colors={["#FFE7E1", "#FF8F7C"]}
              style={{
                minHeight: 150,
                borderRadius: 26,
                borderWidth: 4,
                borderColor: "white",
                padding: 15,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                ...shadow(0.08),
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: "#8A3C32",
                    fontFamily: fonts.bold,
                    fontSize: 11,
                    letterSpacing: 1,
                  }}
                >
                  COMMUNITY
                </Text>
                <Heading size={20} style={{ marginTop: 4 }}>
                  Join the League.
                </Heading>
                <Body style={{ fontSize: 13, lineHeight: 18, marginTop: 5 }}>
                  Share fits, swap advice and get real opinions from people who
                  get it.
                </Body>
              </View>
              <View style={{ width: 116, alignItems: "center", gap: 7 }}>
                <View style={{ flexDirection: "row" }}>
                  {["W", "A", "L"].map((letter, index) => (
                    <View
                      key={letter}
                      style={{
                        width: 34,
                        height: 34,
                        marginLeft: index ? -7 : 0,
                        borderWidth: 2,
                        borderColor: "white",
                        borderRadius: 18,
                        backgroundColor: [colors.yellow, "#DCD5FF", "#CFF5E4"][
                          index
                        ],
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontFamily: fonts.bold, color: ink }}>
                        {letter}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text
                  style={{
                    backgroundColor: ink,
                    color: colors.yellow,
                    fontFamily: fonts.bold,
                    fontSize: 10,
                    paddingHorizontal: 9,
                    paddingVertical: 5,
                    borderRadius: 12,
                  }}
                >
                  Early access
                </Text>
                <Text
                  style={{
                    backgroundColor: "white",
                    borderRadius: 12,
                    padding: 7,
                    fontSize: 10,
                    fontFamily: fonts.medium,
                  }}
                >
                  that jacket goes hard
                </Text>
              </View>
            </LinearGradient>
          </View>

          <View
            style={{
              backgroundColor: "white",
              borderRadius: 26,
              padding: 15,
              marginTop: 8,
              ...shadow(0.04),
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingBottom: 12,
              }}
            >
              <Heading size={18} style={{ flex: 1 }}>
                Free vs Pro
              </Heading>
              <Text
                style={{
                  width: 66,
                  textAlign: "center",
                  fontFamily: fonts.bold,
                  fontSize: 12,
                  color: colors.text2,
                }}
              >
                Free
              </Text>
              <View
                style={{
                  width: 72,
                  backgroundColor: ink,
                  borderRadius: 12,
                  paddingVertical: 4,
                }}
              >
                <Text
                  style={{
                    color: colors.yellow,
                    textAlign: "center",
                    fontFamily: fonts.bold,
                    fontSize: 11,
                  }}
                >
                  PRO
                </Text>
              </View>
            </View>
            {[
              ["Try-ons", "3 to start", "40/month"],
              ["360° views", "—", "5/month"],
              ["Similar store lookalikes", "2 links", "All links"],
              ["Try-on from store links", "—", "✓"],
              ["AI Stylist · uses credits", "✓", "✓"],
              ["Battles", "✓", "✓"],
              ["Browse and save looks", "✓", "✓"],
            ].map(([label, free, pro], index) => (
              <View
                key={label}
                style={{
                  minHeight: 43,
                  flexDirection: "row",
                  alignItems: "center",
                  borderTopWidth: index ? 1 : 0,
                  borderTopColor: "#F0ECE0",
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    color: ink,
                    fontFamily: fonts.medium,
                    fontSize: 13,
                  }}
                >
                  {label}
                </Text>
                <View style={{ width: 66, alignItems: "center" }}>
                  {free === "✓" ? (
                    <Check included />
                  ) : free === "—" ? (
                    <Check included={false} />
                  ) : (
                    <Text
                      style={{
                        color: colors.text2,
                        fontFamily: fonts.medium,
                        fontSize: 12,
                      }}
                    >
                      {free}
                    </Text>
                  )}
                </View>
                <View
                  style={{
                    width: 72,
                    alignItems: "center",
                    backgroundColor: "#FFF6B8",
                    minHeight: 42,
                    justifyContent: "center",
                    borderRadius: 10,
                  }}
                >
                  {pro === "✓" ? (
                    <Check included />
                  ) : (
                    <Text
                      style={{
                        color: ink,
                        fontFamily: fonts.medium,
                        fontSize: 12,
                      }}
                    >
                      {pro}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 5 }}>
            {[
              ["refresh-cw", "Failed try-on? Credits come back", "#DDF5E8"],
              ["sparkles", "1 credit per successful try-on", "#FFF1C2"],
              ["shield", "Your try-on photo stays private", "#E6E1FF"],
            ].map(([icon, label, tint]) => (
              <View
                key={label}
                style={{
                  flex: 1,
                  minHeight: 106,
                  backgroundColor: "white",
                  borderRadius: 20,
                  padding: 10,
                  gap: 8,
                }}
              >
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 10,
                    backgroundColor: tint,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon
                    name={icon as "refresh-cw" | "sparkles" | "shield"}
                    size={17}
                  />
                </View>
                <Text
                  style={{
                    color: ink,
                    fontFamily: fonts.bold,
                    fontSize: 11,
                    lineHeight: 15,
                  }}
                >
                  {label}
                </Text>
              </View>
            ))}
          </View>

          <Body
            style={{
              fontSize: 12,
              lineHeight: 18,
              textAlign: "center",
              marginTop: 8,
            }}
          >
            Renews at the App Store price until cancelled. Any introductory
            offer and eligibility are shown by Apple before purchase. Free
            trials include try-ons only; 360° views start with paid Pro. Cancel
            anytime in Apple settings.
          </Body>
          {Platform.OS === "ios" &&
            process.env.EXPO_PUBLIC_APPLE_SANDBOX_TESTING === "true" && (
              <Text
                style={{
                  alignSelf: "center",
                  backgroundColor: "#FFF1C2",
                  color: ink,
                  fontFamily: fonts.bold,
                  fontSize: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 14,
                }}
              >
                TestFlight sandbox · Apple won’t charge you
              </Text>
            )}
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
                color: ink,
                fontFamily: fonts.bold,
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
        </View>
      </ScrollView>

      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 20,
          paddingTop: 13,
          paddingBottom: Math.max(insets.bottom, 12),
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          backgroundColor: "rgba(255,251,234,0.97)",
          ...shadow(0.1),
        }}
      >
        {purchaseMessage ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{
              color:
                purchaseMessage.includes("couldn’t") ||
                purchaseMessage.includes("couldn't")
                  ? "#8A3C32"
                  : green,
              backgroundColor:
                purchaseMessage.includes("couldn’t") ||
                purchaseMessage.includes("couldn't")
                  ? "#FFE0DB"
                  : "#DDF5E8",
              borderRadius: 12,
              padding: 9,
              marginBottom: 8,
              textAlign: "center",
              fontFamily: fonts.medium,
              fontSize: 13,
            }}
          >
            {purchaseMessage}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={!selectedPackage || loading || ownedPlan}
          onPress={() => void purchase()}
          style={({ pressed }) => ({
            minHeight: 60,
            borderRadius: 22,
            borderWidth: 2.5,
            borderColor: ink,
            backgroundColor: colors.yellow,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 9,
            transform: [{ translateY: pressed ? 3 : 0 }],
            opacity: !selectedPackage || loading || ownedPlan ? 0.55 : 1,
            shadowColor: ink,
            shadowOffset: { width: 0, height: pressed ? 0 : 4 },
            shadowOpacity: 1,
            shadowRadius: 0,
            elevation: pressed ? 0 : 4,
          })}
        >
          {loading ? (
            <ActivityIndicator color={ink} />
          ) : (
            <Icon name="sparkles" size={20} />
          )}
          <Text style={{ color: ink, fontFamily: fonts.bold, fontSize: 16 }}>
            {loading
              ? "Connecting to Apple…"
              : ownedPlan
                ? "You’re on Pro ✓"
                : selectedPackage
                  ? selected === "pack"
                    ? `Buy 15 try-ons · ${price("pack")}`
                    : `Continue · ${price(selected)}${selected === "yearly" ? "/year" : "/month"}`
                  : offersLoading
                    ? "Loading App Store offers…"
                    : purchasesAvailable()
                      ? "Offer unavailable"
                      : "Purchases aren’t configured yet"}
          </Text>
        </Pressable>
        <Text
          style={{
            textAlign: "center",
            color: colors.text3,
            fontFamily: fonts.medium,
            fontSize: 11,
            marginTop: 7,
          }}
        >
          {selected === "pack"
            ? "One-time purchase · try-ons never expire"
            : selected === "yearly"
              ? `${perMonth ? `That’s ${perMonth}/month` : "Billed yearly"} · renews yearly · cancel anytime`
              : "Renews monthly · cancel anytime"}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={close}
          style={{
            minHeight: 34,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: ink, fontFamily: fonts.bold, fontSize: 14 }}>
            Continue with Free · keep browsing
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
