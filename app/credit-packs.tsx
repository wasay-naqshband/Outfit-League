import React, { useEffect } from "react";
import { analytics } from "../src/lib/analytics";
import { View } from "react-native";
import { router } from "expo-router";
import { Body, Button, FlatHeader, Heading, Page } from "../src/components/ui";
import { colors, shadow } from "../src/theme";
export default function CreditPacks() {
  useEffect(() => {
    analytics.track("paywall_viewed", { screen: "credit_packs" });
  }, []);
  return (
    <Page>
      <FlatHeader title="More style, soon" pill="Preview" />
      <View style={{ padding: 20, gap: 18 }}>
        <Heading size={34}>Make room for more looks.</Heading>
        <Body>
          Credit packs are not on sale yet. We’ll show the price, number of
          credits, and store terms before any future purchase.
        </Body>
        <View
          style={{
            backgroundColor: colors.white,
            borderRadius: 28,
            padding: 22,
            gap: 12,
            ...shadow(0.06),
          }}
        >
          <Heading size={25}>One credit. One successful try-on.</Heading>
          <Body>
            A credit is reserved when generation starts. It is used only when
            your result completes. Failed generations return it automatically.
          </Body>
          <Body>
            Browsing, saving inspiration, shopping the sample catalog, and
            voting in battles do not use try-on credits.
          </Body>
        </View>
        <Button title="Credit packs coming soon" disabled />
        <Body>
          No purchase or subscription can be started in this preview. Payment
          and purchase restoration will be available only after the stores are
          connected.
        </Body>
        <Button
          secondary
          title="Back to your credits"
          onPress={() => router.replace("/credits")}
        />
      </View>
    </Page>
  );
}
