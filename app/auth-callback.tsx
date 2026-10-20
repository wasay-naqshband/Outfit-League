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
export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string; recovery?: string }>();
  const url = Linking.useURL();
  const [error, setError] = useState("");
  const exchange = useRef<Promise<boolean> | null>(null);
  useEffect(() => {
    let active = true;
    async function complete() {
      if (!supabase) throw new Error("Not configured");
      const initial = url ?? (await Linking.getInitialURL());
      const parsed = initial ? new URL(initial) : null;
      const fragment = new URLSearchParams(parsed?.hash.slice(1) ?? "");
      const code = params.code ?? parsed?.searchParams.get("code");
      const recovery =
        params.recovery === "1" ||
        parsed?.searchParams.get("recovery") === "1" ||
        fragment.get("type") === "recovery";
      let authError;
      if (code)
        ({ error: authError } =
          await supabase.auth.exchangeCodeForSession(code));
      else if (fragment.get("access_token") && fragment.get("refresh_token"))
        ({ error: authError } = await supabase.auth.setSession({
          access_token: fragment.get("access_token")!,
          refresh_token: fragment.get("refresh_token")!,
        }));
      else throw new Error("Missing confirmation");
      if (authError) throw authError;
      return recovery;
    }
    // The same code must not be exchanged twice during development effect replay.
    exchange.current ??= complete();
    void exchange.current
      .then(async (recovery) => {
        const battle = recovery ? null : await takeBattleReturn();
        if (active) {
          if (battle)
            router.replace({
              pathname: "/battle/[id]",
              params: { id: battle },
            });
          else router.replace(recovery ? "/reset-password" : "/(tabs)");
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
