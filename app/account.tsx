import React, { useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import { router } from "expo-router";
import { Body, Button, FlatHeader, Heading, Page } from "../src/components/ui";
import { useApp } from "../src/lib/state";
import { supabase } from "../src/lib/supabase";
import { accountAction } from "../src/lib/account";
import { colors, fonts } from "../src/theme";
import { useQueryClient } from "@tanstack/react-query";
import { decode } from "base64-arraybuffer";
import { Avatar } from "../src/components/Avatar";
import { useProfile } from "../src/lib/queries";
import { pickAvatar } from "../src/lib/photos";
import { startOAuth, type SocialProvider } from "../src/lib/oauth";
export default function Account() {
  const { session } = useApp();
  const [name, setName] = useState(""),
    [message, setMessage] = useState(""),
    [deleting, setDeleting] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false);
  const provider = session?.user.app_metadata.provider as
    SocialProvider | "email" | undefined;
  const socialProvider = provider === "google" || provider === "apple";
  const profile = useProfile();
  const client = useQueryClient();
  useEffect(() => {
    if (profile.data) setName(profile.data.name);
  }, [profile.data?.name]);
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
    if (!error) void client.invalidateQueries({ queryKey: ["profile"] });
    setMessage(
      error
        ? "Your name couldn’t be saved. Please retry."
        : "Name saved. Existing public votes keep the name you approved when voting.",
    );
  }
  async function photo(remove = false) {
    if (!supabase || !session || busy) return;
    setMessage("");
    try {
      const jpeg = remove ? null : await pickAvatar();
      if (!remove && !jpeg) return;
      setBusy(true);
      const bucket = supabase.storage.from("avatars");
      const path = `${session.user.id}/avatar.jpg`;
      const { error } = jpeg
        ? await bucket.upload(path, decode(jpeg), {
            contentType: "image/jpeg",
            upsert: true,
          })
        : await bucket.remove([path]);
      if (error) throw error;
      await client.invalidateQueries({ queryKey: ["profile"] });
    } catch {
      setMessage("Your photo couldn’t be updated. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  async function reauthenticate(provider: SocialProvider) {
    setBusy(true);
    setMessage("");
    try {
      await startOAuth(provider, "account");
    } catch {
      setMessage(
        `${provider === "google" ? "Google" : "Apple"} sign-in isn’t available yet. Please try again later.`,
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!supabase || !session?.user.email || busy) return;
    setBusy(true);
    setMessage("");
    try {
      if (!socialProvider) {
        const auth = await supabase.auth.signInWithPassword({
          email: session.user.email,
          password,
        });
        setPassword("");
        if (auth.error)
          throw new Error(
            "Your password could not be verified. No deletion has started.",
          );
      }
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
      <FlatHeader title="Edit profile" />
      <View style={{ padding: 20, gap: 16 }}>
        {!session ? (
          <Button title="Sign in" onPress={() => router.push("/auth")} />
        ) : (
          <>
            <View style={{ alignItems: "center", gap: 12 }}>
              <Avatar uri={profile.data?.avatar} name={name} size={112} />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button
                  secondary
                  icon="camera"
                  title={profile.data?.avatar ? "Change photo" : "Add photo"}
                  disabled={busy}
                  onPress={() => void photo()}
                />
                {!!profile.data?.avatar && (
                  <Button
                    secondary
                    title="Remove"
                    disabled={busy}
                    onPress={() => void photo(true)}
                  />
                )}
              </View>
              <Body style={{ fontSize: 13, textAlign: "center" }}>
                Shown with your look when you battle a friend.
              </Body>
            </View>
            <Heading size={22}>What should we call you?</Heading>
            <Body>
              Shown on friend battles and public votes you choose to make.
            </Body>
            <TextInput
              accessibilityLabel="Profile display name"
              value={name}
              onChangeText={setName}
              maxLength={40}
              placeholder="Your name"
              style={field}
            />
            <Button
              title="Save name"
              disabled={busy || name.trim().length < 2}
              onPress={() => void save()}
            />
            <Heading size={22}>Delete account</Heading>
            {!deleting ? (
              <Button
                secondary
                title="Review account deletion"
                onPress={() => setDeleting(true)}
              />
            ) : (
              <>
                <Body>
                  This permanently removes your Closet, saved looks, photos,
                  credit balance and account. Your battles become unavailable
                  and your votes are removed. This cannot be undone.
                </Body>
                <Body>
                  Access is blocked when the request is accepted. File and
                  account cleanup starts after a safety delay of about 2 hours
                  10 minutes, allowing issued upload links to expire. Cleanup
                  retries if a service is unavailable. Existing image links may
                  work for up to five minutes; downloaded copies and
                  provider-held copies cannot be recalled. Wait for any active
                  try-on to finish first.
                </Body>
                <Body>
                  {socialProvider
                    ? `Sign in again with ${provider === "google" ? "Google" : "Apple"}, return here, then type DELETE to confirm permanent deletion.`
                    : "Type DELETE and enter your password to confirm permanent deletion. Your password is used only for Supabase sign-in."}
                </Body>
                {socialProvider && (
                  <Button
                    secondary
                    icon={provider}
                    title={`Sign in again with ${provider === "google" ? "Google" : "Apple"}`}
                    disabled={busy}
                    onPress={() => void reauthenticate(provider)}
                  />
                )}
                <TextInput
                  accessibilityLabel="Type DELETE to confirm"
                  value={confirmation}
                  onChangeText={setConfirmation}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={field}
                />
                {!socialProvider && (
                  <TextInput
                    accessibilityLabel="Confirm your password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoComplete="current-password"
                    style={field}
                  />
                )}
                <Button
                  title={busy ? "Submitting…" : "Permanently delete my account"}
                  disabled={
                    busy ||
                    confirmation !== "DELETE" ||
                    (!socialProvider && !password)
                  }
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
