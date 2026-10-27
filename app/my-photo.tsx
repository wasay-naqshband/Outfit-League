import React, { useState } from "react";
import { Platform, Text, View } from "react-native";
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
import { PhotoGuide } from "../src/components/PhotoGuide";
import { useSavedPhoto } from "../src/lib/queries";
import { useTryOnDraft } from "../src/lib/tryon-draft";
import { pickPhoto } from "../src/lib/photos";
import { removeSavedPhoto, saveSavedPhoto } from "../src/lib/saved-photo";
import { colors, fonts, shadow } from "../src/theme";

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
      // Refetch the stored copy: the picked file is temporary and gets deleted.
      await client.invalidateQueries({
        queryKey: ["saved-photo", session.user.id],
      });
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
          <View
            style={{
              aspectRatio: 4 / 5,
              borderRadius: 28,
              overflow: "hidden",
              backgroundColor: colors.ink,
              ...shadow(0.18),
            }}
          >
            <Image
              source={{ uri: photo.uri }}
              contentFit="cover"
              contentPosition="top"
              transition={200}
              style={{ flex: 1 }}
              accessibilityLabel="Your saved try-on photo"
            />
            <View
              style={{
                position: "absolute",
                left: 14,
                bottom: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: colors.white,
                borderRadius: 999,
                paddingVertical: 8,
                paddingHorizontal: 12,
              }}
            >
              <Icon name="check" size={16} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 13 }}>
                Used for every try-on
              </Text>
            </View>
          </View>
        ) : (
          <Heading size={28}>One great photo, every try-on.</Heading>
        )}
        <Body>
          {photo
            ? "This photo is used for every try-on. It’s kept privately in your account, even if you delete it from your camera roll."
            : "Take or choose one clear photo. We keep it privately in your account so it’s ready for every try-on."}
        </Body>
        <PhotoGuide />
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
