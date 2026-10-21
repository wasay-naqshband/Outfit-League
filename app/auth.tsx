import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  Body,
  Button,
  FlatHeader,
  Heading,
  Page,
  SegmentedControl,
} from "../src/components/ui";
import { supabase } from "../src/lib/supabase";
import { colors as c, fonts } from "../src/theme";
import { authRedirect } from "../src/lib/auth-links";
import { takeBattleReturn } from "../src/lib/battles";
import { startOAuth, type SocialProvider } from "../src/lib/oauth";

export default function Auth() {
  const [mode, setMode] = useState<"Sign in" | "Sign up" | "Reset">("Sign in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function social(provider: SocialProvider) {
    if (!supabase || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await startOAuth(provider);
    } catch {
      setMessage(
        `${provider === "google" ? "Google" : "Apple"} sign-in isn’t available yet. Please use email or try again later.`,
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!supabase || busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setMessage("Enter a valid email address.");
      return;
    }
    if (mode !== "Reset" && password.length < 8) {
      setMessage("Use a password with at least 8 characters.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result =
        mode === "Reset"
          ? await supabase.auth.resetPasswordForEmail(email.trim(), {
              redirectTo: authRedirect(true),
            })
          : mode === "Sign up"
            ? await supabase.auth.signUp({
                email: email.trim(),
                password,
                options: { emailRedirectTo: authRedirect() },
              })
            : await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
              });
      if (result.error) {
        setMessage(
          "We couldn’t complete that request. Check your details and try again.",
        );
        return;
      }
      if ("session" in result.data && result.data.session) {
        const battle = await takeBattleReturn();
        if (battle)
          router.replace({ pathname: "/battle/[id]", params: { id: battle } });
        else router.replace("/(tabs)");
      } else
        setMessage(
          mode === "Reset"
            ? "If an account exists, check your email for reset instructions."
            : "Check your email to confirm your account before signing in.",
        );
    } catch {
      setMessage("Couldn’t connect. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  const field = {
    height: 56,
    backgroundColor: c.white,
    borderRadius: 18,
    paddingHorizontal: 16,
    fontFamily: fonts.body,
    fontSize: 17,
    color: c.ink,
  };
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Page keyboardInsets={false}>
        <FlatHeader title="Welcome" pill="Account" />
        <View style={{ padding: 20, gap: 16 }}>
          <Heading size={34}>
            {mode === "Reset"
              ? "Reset your password."
              : "Welcome to the league."}
          </Heading>
          {mode !== "Reset" && (
            <SegmentedControl
              options={["Sign in", "Sign up"]}
              selected={mode}
              onChange={(value) => {
                setMode(value as "Sign in" | "Sign up");
                setMessage("");
              }}
            />
          )}
          {!supabase && (
            <Body>
              Email authentication needs a Supabase project. This local build is
              in demo mode; you can browse without an account.
            </Body>
          )}
          {mode !== "Reset" && (
            <View style={{ gap: 10 }}>
              <Button
                secondary
                icon="google"
                title="Continue with Google"
                onPress={() => void social("google")}
                disabled={!supabase || busy}
              />
              <Button
                secondary
                icon="apple"
                title="Continue with Apple"
                onPress={() => void social("apple")}
                disabled={!supabase || busy}
              />
              <View
                accessibilityElementsHidden
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <View
                  style={{ flex: 1, height: 1, backgroundColor: c.inactive }}
                />
                <Body style={{ fontSize: 13 }}>or use email</Body>
                <View
                  style={{ flex: 1, height: 1, backgroundColor: c.inactive }}
                />
              </View>
            </View>
          )}
          <TextInput
            accessibilityLabel="Email address"
            placeholder="Email address"
            placeholderTextColor={c.placeholder}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            style={field}
            editable={!busy}
          />
          {mode !== "Reset" && (
            <View style={{ gap: 10 }}>
              <TextInput
                accessibilityLabel="Password"
                placeholder="Password · at least 8 characters"
                placeholderTextColor={c.placeholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={
                  mode === "Sign up" ? "new-password" : "current-password"
                }
                style={field}
                editable={!busy}
              />
              {mode === "Sign in" && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Forgot password"
                  onPress={() => {
                    setMode("Reset");
                    setMessage("");
                  }}
                  style={{ alignSelf: "flex-end", paddingVertical: 2 }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.bold,
                      fontSize: 15,
                      color: c.ink,
                    }}
                  >
                    Forgot password?
                  </Text>
                </Pressable>
              )}
            </View>
          )}
          {!!message && (
            <Body
              style={{ backgroundColor: c.chip, padding: 16, borderRadius: 18 }}
            >
              {message}
            </Body>
          )}
          <Button
            title={
              busy
                ? "Please wait…"
                : mode === "Reset"
                  ? "Send reset email"
                  : mode
            }
            onPress={() => {
              void submit();
            }}
            disabled={!supabase || busy}
          />
          <Button
            secondary
            title="Browse the demo"
            onPress={() => router.replace("/(tabs)")}
          />
          {mode === "Reset" && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to sign in"
              onPress={() => {
                setMode("Sign in");
                setMessage("");
              }}
              style={{ alignSelf: "center", padding: 6 }}
            >
              <Text
                style={{ fontFamily: fonts.bold, fontSize: 15, color: c.ink }}
              >
                Back to sign in
              </Text>
            </Pressable>
          )}
        </View>
      </Page>
    </KeyboardAvoidingView>
  );
}
