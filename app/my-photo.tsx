import React, { useState } from "react";
import { Platform, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useQueryClient } from "@tanstack/react-query";
import {
  Body,
  Button,
  FlatHeader,
  Heading,
  Icon,
  Page,
} from "../src/components/ui";
import { useApp } from "../src/lib/state";
import { useSavedPhoto } from "../src/lib/queries";
import { useTryOnDraft } from "../src/lib/tryon-draft";
import { pickPhoto } from "../src/lib/photos";
import { removeSavedPhoto, saveSavedPhoto } from "../src/lib/saved-photo";
import { colors } from "../src/theme";

const TIPS = [
  "Your whole body, head to toe, in the frame",
  "Stand straight, facing the camera, arms a little away from your body",
  "Plain wall or background, good even light",
  "Fitted clothes work best — avoid bulky coats",
  "Ask a friend or use the camera timer",
];

export default function MyPhoto() {
  const { session } = useApp();
  const saved = useSavedPhoto();
  const draft = useTryOnDraft();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const photo = saved.data;

  async function choose(camera: boolean) {
    if (!session || busy) return;
    setError("");
    try {
      const picked = await pickPhoto(camera);
      if (!picked) return;
      setBusy(true);
      await saveSavedPhoto(session.user.id, picked);
      client.setQueryData(["saved-photo", session.user.id], picked);
      draft.setPerson(picked);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!session || busy) return;
    setBusy(true);
    setError("");
    try {
      await removeSavedPhoto(session.user.id);
      client.setQueryData(["saved-photo", session.user.id], null);
      draft.setPerson(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <FlatHeader title="Your photo" />
      <View style={{ padding: 20, gap: 16 }}>
        {photo ? (
          <Image
            source={{ uri: photo.uri }}
            contentFit="contain"
            style={{
              height: 360,
              borderRadius: 28,
              backgroundColor: colors.white,
            }}
            accessibilityLabel="Your saved try-on photo"
          />
        ) : (
          <Heading size={28}>One great photo, every try-on.</Heading>
        )}
        <Body>
          {photo
            ? "This photo is used for every try-on. It’s kept privately in your account, even if you delete it from your camera roll."
            : "Take or choose one clear photo. We keep it privately in your account so it’s ready for every try-on."}
        </Body>
        <View
          style={{
            backgroundColor: colors.white,
            borderRadius: 22,
            padding: 18,
            gap: 12,
          }}
        >
          <Heading size={18}>For the best results</Heading>
          {TIPS.map((tip) => (
            <View
              key={tip}
              style={{
                flexDirection: "row",
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              <Icon name="check" size={18} />
              <Body style={{ flex: 1, fontSize: 15 }}>{tip}</Body>
            </View>
          ))}
        </View>
        {!session ? (
          <Button
            title="Sign in to save your photo"
            onPress={() => router.push("/auth")}
          />
        ) : (
          <>
            {Platform.OS !== "web" && (
              <Button
                icon="camera"
                title={photo ? "Take a new photo" : "Take photo now"}
                disabled={busy}
                onPress={() => void choose(true)}
              />
            )}
            <Button
              secondary={Platform.OS !== "web"}
              icon="image"
              title="Choose from gallery"
              disabled={busy}
              onPress={() => void choose(false)}
            />
            {!!photo && (
              <Button
                secondary
                title="Delete saved photo"
                disabled={busy}
                onPress={() => void remove()}
              />
            )}
            {!!error && <Body>{error}</Body>}
          </>
        )}
      </View>
    </Page>
  );
}
