import React, { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Body, Button, Heading, Icon } from "../src/components/ui";
import { useApp } from "../src/lib/state";
import { supabase } from "../src/lib/supabase";
import { accountAction } from "../src/lib/account";
import { colors, fonts, shadow } from "../src/theme";
import { useQueryClient } from "@tanstack/react-query";
import { decode } from "base64-arraybuffer";
import {
  ProfileAvatar,
  ProfileButton,
  ProfilePage,
} from "../src/components/ProfileControls";
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
  const [focused, setFocused] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
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
  const nameChanged = name.trim() !== (profile.data?.name ?? "").trim();
  useEffect(() => {
    if (!nameSaved) return;
    const timer = setTimeout(() => setNameSaved(false), 1500);
    return () => clearTimeout(timer);
  }, [nameSaved]);
  async function save() {
    if (!supabase || !session || busy || !nameChanged || name.trim().length < 2)
      return;
    setBusy(true);
    setSavingName(true);
    setNameSaved(false);
    setMessage("");
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: name.trim() })
        .eq("id", session.user.id);
      if (error) throw error;
      await client.invalidateQueries({ queryKey: ["profile"] });
      setNameSaved(true);
    } catch {
      setMessage("Your name couldn’t be saved. Please retry.");
    } finally {
      setBusy(false);
      setSavingName(false);
    }
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
    <ProfilePage title="Edit profile" edit>
      {!session ? (
        <View style={{ padding: 20 }}>
          <Button title="Sign in" onPress={() => router.push("/auth")} />
        </View>
      ) : (
        <>
          <View style={{ alignItems: "center", marginTop: -96 }}>
            <View style={{ width: 148, height: 148 }}>
              <ProfileAvatar
                uri={profile.data?.avatar}
                name={name}
                size={148}
                border={6}
                borderColor={colors.white}
              />
              <ProfileButton
                label="Change photo"
                icon="camera"
                circle
                disabled={busy}
                onPress={() => void photo()}
                style={{ position: "absolute", bottom: 6, right: 2, width: 48 }}
              />
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: -30,
                  top: 18,
                  paddingHorizontal: 10,
                  paddingTop: 2,
                  paddingBottom: 4,
                  borderRadius: 12,
                  borderWidth: 3,
                  borderColor: colors.white,
                  backgroundColor: colors.pink,
                  transform: [{ rotate: "-9deg" }],
                  ...shadow(0.18),
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.heading,
                    fontSize: 15,
                    color: colors.ink,
                  }}
                >
                  That's you
                </Text>
              </View>
            </View>
            <View
              style={{
                marginTop: 14,
                minHeight: 44,
                paddingHorizontal: 20,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.body,
                  fontSize: 13,
                  color: colors.text3,
                }}
              >
                Shown with your look in battles
              </Text>
              {!!profile.data?.avatar && (
                <>
                  <Text style={{ color: "#CFCAD9" }}>·</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Remove photo"
                    disabled={busy}
                    onPress={() => void photo(true)}
                    style={{ minHeight: 44, justifyContent: "center" }}
                  >
                    <Text
                      style={{
                        fontFamily: fonts.bold,
                        fontSize: 13,
                        color: "#B3301C",
                      }}
                    >
                      Remove
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
          <View
            style={{
              marginHorizontal: 20,
              marginTop: 14,
              paddingTop: 18,
              paddingHorizontal: 16,
              paddingBottom: 16,
              borderRadius: 26,
              backgroundColor: colors.white,
              ...shadow(0.06),
            }}
          >
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: fonts.heading,
                fontSize: 20,
                letterSpacing: -0.5,
                color: colors.ink,
              }}
            >
              What should we call you?
            </Text>
            <Text
              style={{
                marginTop: 4,
                fontFamily: fonts.body,
                fontSize: 13,
                color: colors.text3,
              }}
            >
              Shown on battles and public votes.
            </Text>
            <View
              style={{
                marginTop: 14,
                minHeight: 54,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingHorizontal: 14,
                borderRadius: 18,
                backgroundColor: "#FFF8D9",
                borderWidth: 2,
                borderColor:
                  focused || nameChanged ? colors.ink : "transparent",
              }}
            >
              <Icon name="user" size={19} color={colors.text3} />
              <TextInput
                accessibilityLabel="Profile display name"
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  setNameSaved(false);
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                editable={!busy}
                maxLength={40}
                placeholder="Your name"
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: 50,
                  fontFamily: fonts.medium,
                  fontSize: 16,
                  color: colors.ink,
                  paddingVertical: 0,
                }}
              />
              <Icon name="edit-2" size={17} color={colors.text3} />
            </View>
            <ProfileButton
              label={nameSaved ? "Saved" : "Save name"}
              saved={nameSaved}
              busy={savingName}
              disabled={busy || !nameChanged || name.trim().length < 2}
              onPress={() => void save()}
              style={{ marginTop: 14 }}
            />
          </View>
          <View style={{ marginHorizontal: 20, marginTop: 22 }}>
            {!deleting ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  padding: 16,
                  borderRadius: 24,
                  borderWidth: 1.5,
                  borderColor: "#F7D3CB",
                  backgroundColor: "#FFF3F0",
                }}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 14,
                    backgroundColor: "#FFE1DA",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="trash-2" size={20} color="#B3301C" />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text
                    style={{
                      fontFamily: fonts.bold,
                      fontSize: 15,
                      color: "#7A2414",
                    }}
                  >
                    Delete account
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.body,
                      fontSize: 13,
                      color: "#9A5A4C",
                    }}
                  >
                    See what gets removed first.
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Review account deletion"
                  onPress={() => setDeleting(true)}
                  style={{
                    minHeight: 44,
                    paddingHorizontal: 14,
                    borderRadius: 14,
                    borderWidth: 2,
                    borderColor: "#B3301C",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.bold,
                      fontSize: 14,
                      color: "#B3301C",
                    }}
                  >
                    Review
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: 16 }}>
                <Heading size={22}>Delete account</Heading>
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
              </View>
            )}
          </View>
        </>
      )}
      {!!message && (
        <View accessibilityRole="alert" style={{ padding: 20 }}>
          <Body>{message}</Body>
        </View>
      )}
    </ProfilePage>
  );
}
