import React from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import { useQuery } from "@tanstack/react-query";
import {
  Body,
  FlatHeader,
  Heading,
  Icon,
  type IconName,
  Page,
} from "../src/components/ui";
import { accountAction } from "../src/lib/account";
import { useApp } from "../src/lib/state";
import { supabase } from "../src/lib/supabase";
import { useProfile, useWallet } from "../src/lib/queries";
import { colors } from "../src/theme";
import { Avatar } from "../src/components/Avatar";

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Body style={{ fontSize: 13, marginLeft: 6, color: colors.text3 }}>
        {title}
      </Body>
      <View
        style={{
          backgroundColor: colors.white,
          borderRadius: 22,
          overflow: "hidden",
        }}
      >
        {React.Children.toArray(children)
          .filter(Boolean)
          .map((child, i) => (
            <View
              key={i}
              style={
                i
                  ? { borderTopWidth: 1, borderTopColor: colors.cream }
                  : undefined
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
  value,
  onPress,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 16,
        paddingHorizontal: 18,
        backgroundColor: pressed ? colors.chip : colors.white,
      })}
    >
      <Icon name={icon} size={20} />
      <Body style={{ flex: 1, fontSize: 16, color: colors.ink }}>{label}</Body>
      {!!value && <Body style={{ fontSize: 15 }}>{value}</Body>}
      <Icon name="chevron-right" size={18} color={colors.text3} />
    </Pressable>
  );
}

export default function Settings() {
  const { session } = useApp();
  const profile = useProfile();
  const wallet = useWallet();
  // Same query as the moderation screen; the server refuses non-moderators.
  const isAdmin = useQuery({
    queryKey: ["moderation", session?.user.id],
    queryFn: () => accountAction({ action: "reports" }),
    enabled: !!session,
    retry: false,
  }).isSuccess;
  const name = profile.data?.name;
  return (
    <Page>
      <FlatHeader title="Settings" />
      <View style={{ padding: 20, gap: 22 }}>
        <Pressable
          onPress={() => router.push(session ? "/account" : "/auth")}
          accessibilityRole="button"
          accessibilityLabel={session ? "Edit profile" : "Sign in"}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 16,
            padding: 18,
            borderRadius: 26,
            backgroundColor: colors.white,
          }}
        >
          <Avatar uri={profile.data?.avatar} name={name} size={64} />
          <View style={{ flex: 1, gap: 2 }}>
            <Heading size={22}>
              {!session ? "Sign in" : name?.trim() || "Add your name"}
            </Heading>
            <Body style={{ fontSize: 14 }}>
              {session?.user.email ?? "Save your looks and credits"}
            </Body>
          </View>
          <Icon name="chevron-right" size={20} color={colors.text3} />
        </Pressable>

        {session && (
          <Group title="TRY-ONS">
            <Row
              icon="sparkles"
              label="Credits"
              value={wallet.data ? `${wallet.data.available} left` : undefined}
              onPress={() => router.push("/credits")}
            />
            <Row
              icon="camera"
              label="Your try-on photo"
              onPress={() => router.push("/my-photo")}
            />
            <Row
              icon="clock"
              label="Try-on history"
              onPress={() => router.push("/history")}
            />
          </Group>
        )}

        <Group title="PRIVACY & HELP">
          <Row
            icon="shield"
            label="Your photos & privacy"
            onPress={() => router.push("/privacy")}
          />
          <Row
            icon="help-circle"
            label="Contact support"
            onPress={() => router.push("/support")}
          />
        </Group>

        {isAdmin && (
          <Group title="ADMIN">
            <Row
              icon="flag"
              label="Review battle reports"
              onPress={() => router.push("/moderation")}
            />
          </Group>
        )}

        {session && (
          <Group title="ACCOUNT">
            <Row
              icon="log-out"
              label="Sign out"
              onPress={() => {
                void supabase?.auth
                  .signOut()
                  .then(() => router.replace("/welcome"));
              }}
            />
          </Group>
        )}

        <Body style={{ fontSize: 13, textAlign: "center" }}>
          Outfit League {Constants.expoConfig?.version}
        </Body>
      </View>
    </Page>
  );
}
