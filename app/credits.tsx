import React from "react";
import { Linking, View } from "react-native";
import { router } from "expo-router";
import {
  Body,
  Button,
  ErrorState,
  FlatHeader,
  Heading,
  Page,
} from "../src/components/ui";
import { useApp } from "../src/lib/state";
import { useWallet } from "../src/lib/queries";
export default function Credits() {
  const { session } = useApp(),
    wallet = useWallet();
  return (
    <Page>
      <FlatHeader title="More possibilities" pill="Credits" />
      <View style={{ padding: 20, gap: 16 }}>
        <Heading size={34}>A little style goes a long way.</Heading>
        {!session ? (
          <>
            <Body>
              New accounts receive three complimentary successful try-ons.
              Browsing and viewing sample results use no credits.
            </Body>
            <Button title="Sign in" onPress={() => router.push("/auth")} />
          </>
        ) : wallet.isError ? (
          <ErrorState
            message="We couldn’t load your credit balance."
            retry={() => {
              void wallet.refetch();
            }}
          />
        ) : wallet.data ? (
          <>
            <Heading size={34}>{wallet.data.available} available</Heading>
            <Body>
              {wallet.data.subscription_active
                ? `${wallet.data.subscription_tryons} Pro try-ons and ${wallet.data.subscription_spins} included 360° views left this month. Unused monthly allowances expire.`
                : "Free and purchased credits stay available until you use them."}
            </Body>
            {!!wallet.data.reserved && (
              <Body>
                {wallet.data.reserved} credit(s) reserved for work in progress.
              </Body>
            )}
          </>
        ) : (
          <Body>Loading your balance…</Body>
        )}
        <Body>
          One successful generation uses one credit. Failed or timed-out
          generations return the reserved credit. The server controls your
          balance.
        </Body>
        <Button
          title={
            wallet.data?.subscription_active
              ? "Manage your Pro options"
              : "See plans and try-on packs"
          }
          onPress={() => router.push("/paywall")}
        />
        <Body>
          {wallet.data?.subscription_active
            ? "Manage or cancel subscriptions in your Apple Account settings."
            : "App Store offers appear when they’re available on your iPhone. Closing this page keeps browsing free."}
        </Body>
        {wallet.data?.subscription_active && (
          <Button
            secondary
            title="Open Apple subscriptions"
            onPress={() =>
              void Linking.openURL(
                "https://apps.apple.com/account/subscriptions",
              )
            }
          />
        )}
        {session && (
          <Button
            secondary
            title="View credit activity"
            onPress={() => router.push("/credit-history")}
          />
        )}
        <Button
          secondary
          title="About credit packs"
          onPress={() => router.push("/credit-packs")}
        />
      </View>
    </Page>
  );
}
