import React from "react";
import { View } from "react-native";
import { Body, FlatHeader, Page } from "../src/components/ui";
import { StyleGrid, toggle } from "../src/screens/Onboarding";
import { useOnboarding } from "../src/lib/onboarding";

export default function Styles() {
  const { answers, update } = useOnboarding();
  return (
    <Page>
      <FlatHeader title="Your style" />
      <View style={{ padding: 20, gap: 16 }}>
        <Body>Explore opens on fits from your first pick.</Body>
        <StyleGrid
          selected={answers.styles}
          onToggle={(id) => update({ styles: toggle(answers.styles, id) })}
        />
      </View>
    </Page>
  );
}
