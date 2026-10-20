import React, { useState } from "react";
import { View, Share } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActionTile,
  Button,
  DemoNote,
  FlatHeader,
  HeroCard,
  Page,
  SegmentedControl,
} from "../src/components/ui";
import { getOutfit } from "../src/data";
import { useApp } from "../src/lib/state";
import { FloatingTabBar } from "../src/components/FloatingTabBar";
import LiveResult from "../src/screens/LiveResult";

export default function Result() {
  const { look, job } = useLocalSearchParams<{ look?: string; job?: string }>();
  const item = getOutfit(look);
  const [segment, setSegment] = useState("After");
  const { saved, toggleSaved } = useApp();
  if (job) return <LiveResult id={job} />;
  return (
    <View style={{ flex: 1 }}>
      <Page>
        <FlatHeader title="Your look">
          <SegmentedControl
            options={["Before", "After"]}
            selected={segment}
            onChange={setSegment}
          />
        </FlatHeader>
        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <HeroCard outfit={item} before={segment === "Before"} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <ActionTile
              label={saved.includes(item.id) ? "Saved locally" : "Save demo"}
              icon="heart"
              onPress={() => toggleSaved(item.id)}
            />
            <ActionTile
              label="Battle it"
              icon="zap"
              onPress={() => router.push("/(tabs)/battles")}
            />
            <ActionTile
              label="Share"
              icon="share"
              onPress={() => {
                void Share.share({
                  message:
                    "Outfit League demo: " +
                    item.name +
                    ". Sample illustration, not an AI-generated photograph.",
                });
              }}
            />
          </View>
          <Button
            icon="shopping-bag"
            title="Shop this look"
            onPress={() =>
              router.push({ pathname: "/shop", params: { look: item.id } })
            }
          />
          <DemoNote text="Sample before/after artwork · no AI generation or credit use" />
        </View>
      </Page>
      <FloatingTabBar active="Try On" />
    </View>
  );
}
