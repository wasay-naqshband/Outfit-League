import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Button, EmptyState, FlatHeader, Page } from "../src/components/ui";
export default function FeaturePreview() {
  return (
    <Page>
      <FlatHeader title="Coming next" pill="Preview" />
      <View style={{ padding: 20, gap: 16 }}>
        <EmptyState
          title="Your wardrobe comes next."
          message="Wardrobe item management and external inspiration imports arrive in Milestone 3. You can already choose photos in Try On and generate privately once the AI provider is connected."
        />
        <Button
          title="Open Try On"
          onPress={() => router.replace("/(tabs)/try-on")}
        />
      </View>
    </Page>
  );
}
