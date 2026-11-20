import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Linking,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useQuery } from "@tanstack/react-query";
import { Body, Icon, type IconName } from "../src/components/ui";
import { ProfileAvatar, ProfilePage } from "../src/components/ProfileControls";
import { useReduceMotion } from "../src/components/ScanHero";
import { LinearGradient } from "expo-linear-gradient";
import { accountAction } from "../src/lib/account";
import { useApp } from "../src/lib/state";
import { supabase } from "../src/lib/supabase";
import { useProfile, useWallet } from "../src/lib/queries";
import {
  askForNotifications,
  forgetPush,
  notificationsAllowed,
} from "../src/lib/notifications";
import { colors, fonts, shadow } from "../src/theme";

function Group({
  title,
  admin,
  children,
}: {
  title: string;
  admin?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: 26 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 4,
          paddingBottom: 10,
        }}
      >
        <Text
          style={{
            fontFamily: fonts.bold,
            fontSize: 12,
            letterSpacing: 1.3,
            color: colors.text3,
          }}
        >
          {title}
        </Text>
        {admin && (
          <View
            style={{
              borderRadius: 6,
              backgroundColor: colors.ink,
              paddingHorizontal: 6,
              paddingVertical: 3,
            }}
          >
            <Text
              style={{
                fontFamily: fonts.bold,
                fontSize: 10,
                color: colors.yellow,
              }}
            >
              ONLY YOU
            </Text>
          </View>
        )}
      </View>
      <View
        style={{
          backgroundColor: colors.white,
          borderRadius: 24,
          overflow: "hidden",
          ...shadow(0.05),
        }}
      >
        {React.Children.toArray(children)
          .filter(Boolean)
          .map((child, i) => (
            <View
              key={i}
              style={
                i ? { borderTopWidth: 1, borderColor: "#F1EEE4" } : undefined
              }
            >
              {child}
            </View>
          ))}
      </View>
    </View>
  );
}

function Row({
  icon,
  label,
  tint,
  value,
  onPress,
  danger = false,
}: {
  icon: IconName;
  label: string;
  tint: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[label, value].filter(Boolean).join(", ")}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 60,
        paddingHorizontal: 16,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: pressed ? colors.chip : colors.white,
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: tint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={19} color={danger ? "#B3301C" : colors.ink} />
      </View>
      <Text
        style={{
          flex: 1,
          fontFamily: fonts.medium,
          fontSize: 16,
          color: danger ? "#B3301C" : colors.ink,
        }}
      >
        {label}
      </Text>
      {value && (
        <View
          style={{
            paddingHorizontal: 10,
            minHeight: 26,
            borderRadius: 999,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: value === "On" ? "#D7F6E3" : "#F1EEE4",
          }}
        >
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: value === "On" ? "#127A55" : colors.text3,
            }}
          />
          <Text
            style={{
              fontFamily: fonts.bold,
              fontSize: 12,
              color: value === "On" ? "#127A55" : colors.text3,
            }}
          >
            {value}
          </Text>
        </View>
      )}
      {!danger && <Icon name="chevron-right" size={18} color="#8A8597" />}
    </Pressable>
  );
}

export default function Settings() {
  const { session } = useApp();
  const profile = useProfile(),
    wallet = useWallet();
  const [error, setError] = useState("");
  const reduce = useReduceMotion(true);
  const twinkle = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduce) {
      twinkle.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, {
          toValue: 0.7,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(twinkle, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, twinkle]);
  const isAdmin = useQuery({
    queryKey: ["moderation", session?.user.id],
    queryFn: () => accountAction({ action: "reports" }),
    enabled: !!session,
    retry: false,
  }).isSuccess;
  const notifications = useQuery({
    queryKey: ["notifications-allowed"],
    queryFn: notificationsAllowed,
    enabled: Platform.OS === "ios",
  });
  const name = profile.data?.name;
  const pro = !!wallet.data?.subscription_active;
  return (
    <ProfilePage title="Settings">
      <View style={{ paddingHorizontal: 20, marginTop: -76 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={session ? "Edit profile" : "Sign in"}
          onPress={() => router.push(session ? "/account" : "/auth")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            padding: 16,
            borderRadius: 28,
            backgroundColor: colors.white,
            ...shadow(0.12),
          }}
        >
          <View>
            <ProfileAvatar
              uri={profile.data?.avatar}
              name={name}
              size={68}
              border={3}
              borderColor={colors.yellow}
            />
            <View
              style={{
                position: "absolute",
                right: -2,
                bottom: -2,
                width: 26,
                height: 26,
                borderRadius: 13,
                borderWidth: 2.5,
                borderColor: colors.white,
                backgroundColor: colors.ink,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="edit-2" size={13} color={colors.yellow} />
            </View>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fonts.heading,
                fontSize: 21,
                color: colors.ink,
              }}
            >
              {!session ? "Sign in" : name?.trim() || "Add your name"}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fonts.body,
                fontSize: 13,
                color: colors.text3,
              }}
            >
              {session?.user.email ?? "Save your looks and credits"}
            </Text>
          </View>
          <View
            style={{
              minHeight: 36,
              paddingHorizontal: 14,
              borderRadius: 999,
              backgroundColor: colors.chip,
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontFamily: fonts.bold,
                fontSize: 13,
                color: colors.ink,
              }}
            >
              {session ? "Edit" : "Sign in"}
            </Text>
          </View>
        </Pressable>
        {session && (
          <>
            <View style={{ marginTop: 16, flexDirection: "row", gap: 12 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  wallet.data
                    ? `Credits, ${wallet.data.available} try-ons left`
                    : "Credits, loading balance"
                }
                onPress={() => router.push("/credits")}
                style={{
                  flex: 1,
                  flexBasis: 0,
                  minWidth: 0,
                  minHeight: 164,
                  padding: 0,
                  borderRadius: 26,
                  backgroundColor: colors.ink,
                  justifyContent: "space-between",
                }}
              >
                <View
                  style={{
                    flex: 1,
                    padding: 16,
                    justifyContent: "space-between",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: fonts.bold,
                        fontSize: 12,
                        letterSpacing: 1.2,
                        color: "#D9D6E3",
                      }}
                    >
                      CREDITS
                    </Text>
                    <Animated.View
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      style={{
                        transform: [{ scale: twinkle }],
                        opacity: twinkle,
                      }}
                    >
                      <MaterialCommunityIcons
                        name="star-four-points"
                        color={colors.yellow}
                        size={19}
                      />
                    </Animated.View>
                  </View>
                  <View>
                    <Text
                      style={{
                        fontFamily: fonts.heading,
                        fontSize: 46,
                        lineHeight: 50,
                        color: colors.yellow,
                      }}
                    >
                      {wallet.data?.available ?? "—"}
                    </Text>
                    <Text
                      style={{
                        fontFamily: fonts.body,
                        fontSize: 13,
                        color: "#D9D6E3",
                      }}
                    >
                      try-ons left
                    </Text>
                  </View>
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  pro ? "Manage Outfit League Pro" : "Get Outfit League Pro"
                }
                onPress={() =>
                  pro
                    ? void Linking.openURL(
                        "https://apps.apple.com/account/subscriptions",
                      )
                    : router.push("/paywall")
                }
                style={{ flex: 1, flexBasis: 0, minWidth: 0 }}
              >
                <LinearGradient
                  colors={["#FFE1F1", "#C9BCFF"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    flex: 1,
                    minHeight: 164,
                    padding: 16,
                    borderRadius: 26,
                    gap: 16,
                    justifyContent: "space-between",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Icon name="zap" size={16} color="#4B3F7A" />
                    <Text
                      style={{
                        fontFamily: fonts.bold,
                        fontSize: 12,
                        letterSpacing: 1.2,
                        color: "#4B3F7A",
                      }}
                    >
                      PRO
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontFamily: fonts.heading,
                      fontSize: 20,
                      lineHeight: 21,
                      color: colors.ink,
                    }}
                  >
                    {pro ? "You're Pro" : "More try-ons & 360° views"}
                  </Text>
                  {pro && (
                    <Text
                      style={{
                        fontFamily: fonts.body,
                        fontSize: 13,
                        color: "#4B3F7A",
                      }}
                    >
                      {wallet.data?.subscription_trial
                        ? "Free trial"
                        : "Active"}
                    </Text>
                  )}
                  <View
                    style={{
                      alignSelf: "flex-start",
                      minHeight: 38,
                      justifyContent: "center",
                      paddingHorizontal: 14,
                      borderRadius: 14,
                      borderWidth: 2,
                      borderColor: colors.ink,
                      backgroundColor: colors.yellow,
                      ...Platform.select({
                        web: { boxShadow: "0 3px 0 #14121F" },
                        default: {
                          shadowColor: colors.ink,
                          shadowOffset: { width: 0, height: 3 },
                          shadowOpacity: 1,
                          shadowRadius: 0,
                          elevation: 3,
                        },
                      }),
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: fonts.bold,
                        fontSize: 14,
                        color: colors.ink,
                      }}
                    >
                      {pro ? "Manage" : "Get Pro"}
                    </Text>
                  </View>
                </LinearGradient>
              </Pressable>
            </View>
            <Group title="TRY-ONS">
              <Row
                icon="camera"
                label="Your try-on photo"
                tint="#FFF1B8"
                onPress={() => router.push("/my-photo")}
              />
              <Row
                icon="sparkles"
                label="Your style"
                tint="#DCD5FF"
                onPress={() => router.push("/styles")}
              />
              <Row
                icon="clock"
                label="Try-on history"
                tint="#D7F6E3"
                onPress={() => router.push("/history")}
              />
            </Group>
          </>
        )}
        {session && Platform.OS === "ios" && (
          <Group title="NOTIFICATIONS">
            <Row
              icon="bell"
              label="Notifications"
              tint="#FFE1F1"
              value={
                notifications.data === undefined
                  ? undefined
                  : notifications.data
                    ? "On"
                    : "Off"
              }
              onPress={() => {
                void (async () => {
                  const before = notifications.data;
                  if (!before) await askForNotifications();
                  const { data: now } = await notifications.refetch();
                  if (before || !now) void Linking.openSettings();
                })();
              }}
            />
          </Group>
        )}
        <Group title="PRIVACY & HELP">
          <Row
            icon="shield"
            label="Your photos & privacy"
            tint="#D7F6E3"
            onPress={() => router.push("/privacy")}
          />
          <Row
            icon="flag"
            label="Terms of Use"
            tint="#F1EEE4"
            onPress={() => router.push("/terms")}
          />
          <Row
            icon="help-circle"
            label="Contact support"
            tint="#E4F1FF"
            onPress={() => router.push("/support")}
          />
        </Group>
        {isAdmin && (
          <Group title="ADMIN" admin>
            <Row
              icon="flag"
              label="Review battle reports"
              tint="#FFE7E1"
              onPress={() => router.push("/moderation")}
            />
          </Group>
        )}
        {session && (
          <View
            style={{
              marginTop: 26,
              borderRadius: 24,
              overflow: "hidden",
              backgroundColor: colors.white,
            }}
          >
            <Row
              icon="log-out"
              label="Sign out"
              tint="#FFE7E1"
              danger
              onPress={() => {
                void forgetPush()
                  .then(() => supabase?.auth.signOut())
                  .then(() => router.replace("/welcome"))
                  .catch(() =>
                    setError("Sign out couldn’t complete. Please try again."),
                  );
              }}
            />
          </View>
        )}
        {!!error && <Body>{error}</Body>}
        <View style={{ alignItems: "center", gap: 4, marginTop: 26 }}>
          <Text
            style={{
              fontFamily: fonts.heading,
              fontSize: 15,
              color: colors.text3,
            }}
          >
            Outfit League
          </Text>
          <Text
            style={{ fontFamily: fonts.body, fontSize: 12, color: "#8A8597" }}
          >
            Version {Constants.expoConfig?.version}
          </Text>
        </View>
      </View>
    </ProfilePage>
  );
}
