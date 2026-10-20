import React from "react";
import { Tabs } from "expo-router";
import { FloatingTabBar } from "../../src/components/FloatingTabBar";
const labels: Record<string, string> = {
  index: "Explore",
  "try-on": "Try On",
  battles: "Battles",
  closet: "Closet",
};
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => (
        <FloatingTabBar
          active={labels[state.routes[state.index]!.name]!}
          onSelect={(label) => {
            const route = state.routes.find(
              (item) => labels[item.name] === label,
            );
            if (!route) return;
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!event.defaultPrevented) navigation.navigate(route.name);
          }}
        />
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="try-on" />
      <Tabs.Screen name="battles" />
      <Tabs.Screen name="closet" />
    </Tabs>
  );
}
