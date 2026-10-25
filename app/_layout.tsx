import React, { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque/800ExtraBold";
import { Figtree_400Regular } from "@expo-google-fonts/figtree/400Regular";
import { Figtree_500Medium } from "@expo-google-fonts/figtree/500Medium";
import { Figtree_700Bold } from "@expo-google-fonts/figtree/700Bold";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActivityIndicator, Text, View } from "react-native";
import { AppProvider, useApp } from "../src/lib/state";
import { useWallet } from "../src/lib/queries";
import { screenName } from "../src/lib/analytics";
import { posthog } from "../src/lib/posthog";
import {
  registerPush,
  scheduleReminders,
  startNotifications,
} from "../src/lib/notifications";
import { colors } from "../src/theme";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TryOnDraftProvider } from "../src/lib/tryon-draft";
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

// Analytics screens and identity, push token, and on-device reminders.
function AppSignals() {
  const { session } = useApp();
  const wallet = useWallet();
  const path = usePathname();
  const user = session?.user.id ?? null;
  const last = useRef<string | null>(null);
  useEffect(startNotifications, []);
  useEffect(() => {
    void posthog?.screen(screenName(path));
  }, [path]);
  useEffect(() => {
    if (user) {
      posthog?.identify(user);
      void registerPush();
    } else if (last.current) posthog?.reset();
    last.current = user;
  }, [user]);
  const trialEnds = wallet.data?.subscription_trial
    ? wallet.data.subscription_expires_at
    : null;
  useEffect(() => {
    void scheduleReminders(trialEnds);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void scheduleReminders(trialEnds);
    });
    return () => sub.remove();
  }, [trialEnds]);
  return null;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    BricolageGrotesque_800ExtraBold,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_700Bold,
  });
  if (error)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.cream,
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Text>
          We couldn’t load the app’s fonts. Please restart Outfit League.
        </Text>
      </View>
    );
  if (!loaded)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.cream,
          justifyContent: "center",
        }}
      >
        <ActivityIndicator
          color={colors.ink}
          accessibilityLabel="Loading Outfit League"
        />
      </View>
    );
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <TryOnDraftProvider>
            <StatusBar style="dark" />
            <AppSignals />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.cream },
                animation: "slide_from_right",
              }}
            />
          </TryOnDraftProvider>
        </AppProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
