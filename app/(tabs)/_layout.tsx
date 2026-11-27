import React from "react";
import { Tabs } from "expo-router";
import { FloatingTabBar } from "../../src/components/FloatingTabBar";
const labels: Record<string, string> = {
  index: "Explore",
  "try-on": "Try On",
  scan: "Scan",
  battles: "Battles",
  closet: "Closet",
};
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, emitter, navigateToTab }) => (
        <FloatingTabBar
          active={labels[state.routes[state.index]!.name]!}
          onSelect={(label) => {
            const route = state.routes.find(
              (item) => labels[item.name] === label,
            );
            if (!route) return;
            const event = emitter.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            const focused = state.routes[state.index]!.key === route.key;
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          }}
        />
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="try-on" />
      <Tabs.Screen name="scan" />
      <Tabs.Screen name="battles" />
      <Tabs.Screen name="closet" />
    </Tabs>
  );
}
