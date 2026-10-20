import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque/800ExtraBold";
import { Figtree_400Regular } from "@expo-google-fonts/figtree/400Regular";
import { Figtree_500Medium } from "@expo-google-fonts/figtree/500Medium";
import { Figtree_700Bold } from "@expo-google-fonts/figtree/700Bold";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActivityIndicator, Text, View } from "react-native";
import { AppProvider } from "../src/lib/state";
import { colors } from "../src/theme";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TryOnDraftProvider } from "../src/lib/tryon-draft";
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

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
