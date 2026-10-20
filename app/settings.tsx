import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Body, Button, FlatHeader, Heading, Page } from "../src/components/ui";
import { useApp } from "../src/lib/state";
import { supabase } from "../src/lib/supabase";
export default function Settings() {
  const { session } = useApp();
  return (
    <Page>
      <FlatHeader title="Your league" pill="Settings" />
      <View style={{ padding: 20, gap: 16 }}>
        <Heading size={34}>
          {session ? "You’re in." : "A fit for every mood."}
        </Heading>
        <Body>
          {session?.user.email ?? "You’re browsing as a guest in demo mode."}
        </Body>
        <Button
          title="Your try-on credits"
          onPress={() => router.push("/credits")}
        />
        <Button
          secondary
          title="Private try-on history"
          onPress={() => router.push("/history")}
        />
        {session ? (
          <Button
            secondary
            title="Sign out"
            onPress={() => {
              void supabase?.auth
                .signOut()
                .then(() => router.replace("/welcome"));
            }}
          />
        ) : (
          <Button
            secondary
            title="Sign in with email"
            onPress={() => router.push("/auth")}
          />
        )}
        <Button
          secondary
          title="View welcome screen"
          onPress={() => router.push("/welcome")}
        />
        <Button
          secondary
          title="Your photos & privacy"
          onPress={() => router.push("/privacy")}
        />
        <Button
          secondary
          title="Profile & account controls"
          onPress={() => router.push("/account")}
        />
        <Button
          secondary
          title="Contact support"
          onPress={() => router.push("/support")}
        />
        <Button
          secondary
          title="Administrator reports"
          onPress={() => router.push("/moderation")}
        />
        <Body style={{ fontSize: 13 }}>
          Your Closet and AI looks stay private unless you explicitly publish
          selected battle images. Shopping uses a labeled sample catalog; live
          retailer feeds and purchases are not enabled.
        </Body>
      </View>
    </Page>
  );
}
