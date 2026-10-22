import React from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useApp } from "../src/lib/state";
import { useOnboarding } from "../src/lib/onboarding";
export default function Index() {
  const { session, ready } = useApp();
  const onboarding = useOnboarding();
  if (!ready || !onboarding.ready)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  // New visitors see onboarding once; signed-in people go straight in.
  return (
    <Redirect
      href={
        session
          ? "/(tabs)"
          : onboarding.answers.done
            ? "/welcome"
            : "/onboarding"
      }
    />
  );
}
