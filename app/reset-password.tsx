import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Body, Button, FlatHeader, Heading, Page } from "../src/components/ui";
import { useApp } from "../src/lib/state";
import { supabase } from "../src/lib/supabase";
import { colors, fonts } from "../src/theme";
export default function ResetPassword() {
  const { session } = useApp();
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function update() {
    if (!supabase || !session || busy) return;
    if (password.length < 8 || password !== confirm) {
      setMessage(
        "Use at least eight characters and make both passwords match.",
      );
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.replace("/(tabs)");
    } catch {
      setMessage(
        "We couldn’t update your password. Request a fresh reset link and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Page keyboardInsets={false}>
        <FlatHeader title="Fresh start" pill="Account" />
        <View style={{ padding: 20, gap: 16 }}>
          <Heading size={30}>Choose a new password.</Heading>
          {!session ? (
            <>
              <Body>
                Open the reset link from your email on this device first.
              </Body>
              <Button
                title="Request a reset link"
                onPress={() => router.replace("/auth")}
              />
            </>
          ) : (
            <>
              <TextInput
                accessibilityLabel="New password"
                secureTextEntry
                autoComplete="new-password"
                placeholder="New password"
                value={password}
                onChangeText={setPassword}
                style={{
                  height: 56,
                  borderRadius: 18,
                  backgroundColor: colors.white,
                  padding: 16,
                  fontFamily: fonts.body,
                }}
              />
              <TextInput
                accessibilityLabel="Confirm new password"
                secureTextEntry
                autoComplete="new-password"
                placeholder="Confirm new password"
                value={confirm}
                onChangeText={setConfirm}
                style={{
                  height: 56,
                  borderRadius: 18,
                  backgroundColor: colors.white,
                  padding: 16,
                  fontFamily: fonts.body,
                }}
              />
              {!!message && <Body>{message}</Body>}
              <Button
                title={busy ? "Updating…" : "Update password"}
                disabled={busy}
                onPress={() => {
                  void update();
                }}
              />
            </>
          )}
        </View>
      </Page>
    </KeyboardAvoidingView>
  );
}
