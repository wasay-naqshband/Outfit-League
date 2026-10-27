import React from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import {
  Button,
  ErrorState,
  FlatHeader,
  Icon,
  Page,
} from "../src/components/ui";
import { useApp } from "../src/lib/state";
import { useWallet } from "../src/lib/queries";
import { colors, fonts, shadow } from "../src/theme";

export default function Credits() {
  const { session } = useApp(),
    wallet = useWallet(),
    w = wallet.data,
    pro = !!w?.subscription_active;
  return (
    <Page>
      <FlatHeader title="Credits" pill={false} />
      <View style={{ paddingHorizontal: 20, gap: 16 }}>
        {wallet.isError ? (
          <ErrorState
            message="We couldn’t load your credit balance."
            retry={() => void wallet.refetch()}
          />
        ) : (
          <View
            style={{
              backgroundColor: colors.ink,
              borderRadius: 32,
              padding: 24,
              gap: 2,
              ...shadow(0.2),
            }}
          >
            <Text style={label}>
              {session ? "CREDITS" : "FREE WHEN YOU SIGN UP"}
            </Text>
            <Text
              style={{
                fontFamily: fonts.heading,
                fontSize: 80,
                lineHeight: 88,
                letterSpacing: -3,
                color: colors.yellow,
              }}
            >
              {!session ? 3 : (w?.available ?? "–")}
            </Text>
            <Text style={sub}>
              1 credit = 1 try-on
              {!!w?.reserved && ` · ${w.reserved} in progress`}
            </Text>
            {pro && (
              <View
                style={{
                  marginTop: 18,
                  paddingTop: 16,
                  borderTopWidth: 1,
                  borderTopColor: "rgba(255,255,255,0.14)",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.bold,
                    fontSize: 12,
                    color: colors.ink,
                    backgroundColor: colors.yellow,
                    borderRadius: 8,
                    overflow: "hidden",
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
                  PRO
                </Text>
                <Text style={[sub, { flex: 1 }]}>
                  {w!.subscription_tryons} try-ons · {w!.subscription_spins} 360°
                  views this month
                </Text>
              </View>
            )}
          </View>
        )}

        {!session ? (
          <Button title="Sign in" onPress={() => router.push("/auth")} />
        ) : (
          <>
            <Button
              icon="sparkles"
              title={pro ? "Change plan" : "Get more try-ons"}
              onPress={() => router.push("/paywall")}
            />
            <View
              style={{
                backgroundColor: colors.white,
                borderRadius: 24,
                paddingHorizontal: 18,
                ...shadow(0.05),
              }}
            >
              <Row
                icon="clock"
                title="Credit activity"
                onPress={() => router.push("/credit-history")}
              />
              {pro && (
                <Row
                  icon="settings"
                  title="Manage subscription"
                  divider
                  onPress={() =>
                    void Linking.openURL(
                      "https://apps.apple.com/account/subscriptions",
                    )
                  }
                />
              )}
            </View>
            <Text
              style={{
                fontFamily: fonts.body,
                fontSize: 13,
                color: colors.text3,
                textAlign: "center",
              }}
            >
              A failed try-on gives the credit back.
            </Text>
          </>
        )}
      </View>
    </Page>
  );
}

const label = {
  fontFamily: fonts.bold,
  fontSize: 12,
  letterSpacing: 1.2,
  color: colors.yellow,
};
const sub = { fontFamily: fonts.medium, fontSize: 15, color: colors.inactive };

function Row({
  icon,
  title,
  divider,
  onPress,
}: {
  icon: "clock" | "settings";
  title: string;
  divider?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 58,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        opacity: pressed ? 0.6 : 1,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: colors.inactive,
      })}
    >
      <Icon name={icon} size={20} />
      <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16 }}>
        {title}
      </Text>
      <Icon name="chevron-right" size={20} color={colors.text3} />
    </Pressable>
  );
}
