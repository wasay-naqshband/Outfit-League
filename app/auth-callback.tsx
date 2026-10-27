import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import {
  Body,
  Button,
  FlatHeader,
  Heading,
  LoadingSkeleton,
  Page,
} from "../src/components/ui";
import { supabase } from "../src/lib/supabase";
import { takeBattleReturn } from "../src/lib/battles";
import { parseAuthCallback } from "../src/lib/auth-callback";
export default function AuthCallback() {
  const params = useLocalSearchParams<{
    code?: string;
    recovery?: string;
    next?: string;
  }>();
  const url = Linking.useURL();
  const [error, setError] = useState("");
  const exchange = useRef<
    Promise<{ recovery: boolean; next: string | null | undefined }> | undefined
  >(undefined);
  useEffect(() => {
    let active = true;
    async function complete() {
      if (!supabase) throw new Error("Not configured");
      const initial = url ?? (await Linking.getInitialURL());
      const { code, recovery, next } = parseAuthCallback(initial, params);
      if (!code) throw new Error("Missing confirmation");
      const { error: authError } =
        await supabase.auth.exchangeCodeForSession(code);
      if (authError) throw authError;
      return { recovery, next };
    }
    // The same code must not be exchanged twice during development effect replay.
    exchange.current ??= complete();
    void exchange.current
      .then(async ({ recovery, next }) => {
        const battle = recovery ? null : await takeBattleReturn();
        if (active) {
          if (battle)
            router.replace({
              pathname: "/battle/[id]",
              params: { id: battle },
            });
          else
            router.replace(
              recovery
                ? "/reset-password"
                : next === "account"
                  ? "/account"
                  : "/(tabs)",
            );
        }
      })
      .catch(() => {
        if (active)
          setError(
            "This link has expired or belongs to another browser. Request a new link on this device.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <Page>
      <FlatHeader title="Welcome back" pill="Account" />
      <View style={{ padding: 20, gap: 16 }}>
        {error ? (
          <>
            <Heading size={28}>Let’s try that again.</Heading>
            <Body>{error}</Body>
            <Button
              title="Return to sign in"
              onPress={() => router.replace("/auth")}
            />
          </>
        ) : (
          <>
            <LoadingSkeleton />
            <Body>Confirming your account…</Body>
          </>
        )}
      </View>
    </Page>
  );
}
