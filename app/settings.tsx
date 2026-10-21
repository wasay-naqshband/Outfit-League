import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import { useQuery } from "@tanstack/react-query";
import { Body, Button, FlatHeader, Heading, Page } from "../src/components/ui";
import { accountAction } from "../src/lib/account";
import { useApp } from "../src/lib/state";
import { supabase } from "../src/lib/supabase";
export default function Settings() {
  const { session } = useApp();
  // Same query as the moderation screen; the server refuses non-moderators.
  const isAdmin = useQuery({
    queryKey: ["moderation", session?.user.id],
    queryFn: () => accountAction({ action: "reports" }),
    enabled: !!session,
    retry: false,
  }).isSuccess;
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
        <Heading size={22}>Account</Heading>
        <Button
          secondary
          title="Profile & account controls"
          onPress={() => router.push("/account")}
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
        <Heading size={22}>Try On</Heading>
        <Button
          title="Your try-on credits"
          onPress={() => router.push("/credits")}
        />
        <Button
          secondary
          title="Private try-on history"
          onPress={() => router.push("/history")}
        />
        <Heading size={22}>Help & privacy</Heading>
        <Button
          secondary
          title="Your photos & privacy"
          onPress={() => router.push("/privacy")}
        />
        <Button
          secondary
          title="Contact support"
          onPress={() => router.push("/support")}
        />
        {isAdmin && (
          <>
            <Heading size={22}>Administration</Heading>
            <Button
              secondary
              title="Review battle reports"
              onPress={() => router.push("/moderation")}
            />
          </>
        )}
        <Body style={{ fontSize: 13, textAlign: "center" }}>
          Outfit League {Constants.expoConfig?.version}
        </Body>
      </View>
    </Page>
  );
}
