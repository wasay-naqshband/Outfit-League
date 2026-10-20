import React, { useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import { router } from "expo-router";
import { Body, Button, FlatHeader, Heading, Page } from "../src/components/ui";
import { useApp } from "../src/lib/state";
import { supabase } from "../src/lib/supabase";
import { accountAction } from "../src/lib/account";
import { colors, fonts } from "../src/theme";
export default function Account() {
  const { session } = useApp();
  const [name, setName] = useState(""),
    [message, setMessage] = useState(""),
    [deleting, setDeleting] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    if (session)
      void supabase
        ?.from("profiles")
        .select("display_name")
        .eq("id", session.user.id)
        .single()
        .then(({ data, error }) => {
          if (live) {
            if (error)
              setMessage(
                "Your profile couldn’t load. Please reopen this page.",
              );
            else setName(data?.display_name ?? "");
          }
        });
    return () => {
      live = false;
    };
  }, [session?.user.id]);
  const field = {
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.white,
    fontFamily: fonts.body,
    fontSize: 16,
  };
  async function save() {
    if (!supabase || !session) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name.trim() })
      .eq("id", session.user.id);
    setBusy(false);
    setMessage(
      error
        ? "Your name couldn’t be saved. Please retry."
        : "Display name saved. Existing public votes keep the name you approved when voting.",
    );
  }
  async function remove() {
    if (!supabase || !session?.user.email || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const auth = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password,
      });
      setPassword("");
      if (auth.error)
        throw new Error(
          "Your password could not be verified. No deletion has started.",
        );
      await accountAction({ action: "delete", confirmation });
      await supabase.auth.signOut({ scope: "local" });
      router.replace("/account-deleted");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please retry.");
    } finally {
      setPassword("");
      setBusy(false);
    }
  }
  return (
    <Page>
      <FlatHeader title="Your account" pill="Control" />
      <View style={{ padding: 20, gap: 16 }}>
        {!session ? (
          <Button title="Sign in" onPress={() => router.push("/auth")} />
        ) : (
          <>
            <Heading size={28}>Your display name</Heading>
            <Body>
              Your name is private until you explicitly consent to show it with
              a public battle vote. Names are self-chosen and do not verify
              identity.
            </Body>
            <TextInput
              accessibilityLabel="Profile display name"
              value={name}
              onChangeText={setName}
              maxLength={40}
              placeholder="Choose a display name"
              style={field}
            />
            <Button
              title="Save display name"
              disabled={busy || name.trim().length < 2}
              onPress={() => void save()}
            />
            <Heading size={28}>Delete account</Heading>
            <Body>
              This permanently removes your Closet, saved looks, photos, credit
              balance and account. Your battles become unavailable and your
              votes are removed. This cannot be undone.
            </Body>
            <Body>
              Access is blocked when the request is accepted. File and account
              cleanup starts after a safety delay of about 2 hours 10 minutes,
              allowing issued upload links to expire. Cleanup retries if a
              service is unavailable. Existing image links may work for up to
              five minutes; downloaded copies and provider-held copies cannot be
              recalled. Wait for any active try-on to finish first.
            </Body>
            {!deleting ? (
              <Button
                secondary
                title="Review account deletion"
                onPress={() => setDeleting(true)}
              />
            ) : (
              <>
                <Body>
                  Type DELETE and enter your password to confirm permanent
                  deletion. Your password is used only for Supabase sign-in.
                </Body>
                <TextInput
                  accessibilityLabel="Type DELETE to confirm"
                  value={confirmation}
                  onChangeText={setConfirmation}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={field}
                />
                <TextInput
                  accessibilityLabel="Confirm your password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="current-password"
                  style={field}
                />
                <Button
                  title={busy ? "Submitting…" : "Permanently delete my account"}
                  disabled={busy || confirmation !== "DELETE" || !password}
                  onPress={() => void remove()}
                />
                <Button
                  secondary
                  title="Keep my account"
                  disabled={busy}
                  onPress={() => {
                    setDeleting(false);
                    setPassword("");
                    setConfirmation("");
                  }}
                />
              </>
            )}
          </>
        )}
        {!!message && <Body>{message}</Body>}
      </View>
    </Page>
  );
}
