import React from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useApp } from "../src/lib/state";
export default function Index() {
  const { session, ready } = useApp();
  if (!ready)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  return <Redirect href={session ? "/(tabs)" : "/welcome"} />;
}
