import React from "react";
import { View } from "react-native";
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
              {wallet.data.reserved
                ? wallet.data.reserved +
                  " credit reserved for your current generation."
                : "No generation is using a reserved credit."}
            </Body>
          </>
        ) : (
          <Body>Loading your balance…</Body>
        )}
        <Body>
          One successful generation uses one credit. Failed or timed-out
          generations return the reserved credit. The server controls your
          balance.
        </Body>
        <Button title="Purchases not available" disabled />
        <Body>
          Credit packs are being prepared. There are no active offers or
          charges. Your existing credits remain available.
        </Body>
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
