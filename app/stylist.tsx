import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useQueryClient } from "@tanstack/react-query";
import { Body, Button, FlatHeader, Heading, Page } from "../src/components/ui";
import { CookingLoader, TRYON_MESSAGES } from "../src/components/CookingLoader";
import { PART_LABEL } from "../src/components/ShopTheLook";
import { useApp } from "../src/lib/state";
import { useSavedPhoto, useTryOnConfig, useWallet } from "../src/lib/queries";
import { styleLabel, useOnboarding } from "../src/lib/onboarding";
import { agreedOnce } from "../src/lib/consent";
import { outOfCredits } from "../src/lib/credits";
import { analytics, trackPhotoProblem } from "../src/lib/analytics";
import { askForNotifications } from "../src/lib/notifications";
import { callTryOn, pickOutfit, uploadPhoto } from "../src/lib/tryon-api";
import { friendlyError, type JobView } from "../src/types/tryon";
import { colors, fonts } from "../src/theme";

const OCCASIONS = [
  ["Today ☀️", "An everyday outfit for today"],
  ["Weekend 🛋️", "A relaxed weekend"],
  ["Date night 💕", "A date night"],
  ["Party 🎉", "A party tonight"],
  ["Work 💼", "A day at the office"],
  ["Wedding 💍", "A wedding, as a guest"],
] as const;
// One wait for both steps: writing the outfit, then dressing their photo.
const MESSAGES = [
  "Reading the room… 👀",
  "Pulling pieces from every rail…",
  "Balancing colours and layers…",
  ...TRYON_MESSAGES,
];
const card = {
  backgroundColor: colors.white,
  borderRadius: 28,
  padding: 20,
  gap: 14,
} as const;

// AI Stylist: Style me writes a full outfit for the occasion and shows it on
// the user's own photo (1 credit). Shop the look waits on the result screen.
export default function Stylist() {
  const { session } = useApp();
  const client = useQueryClient();
  const params = useLocalSearchParams<{ closet?: string; occasion?: string }>();
  const styles = useOnboarding().answers.styles.map(styleLabel);
  const saved = useSavedPhoto();
  const wallet = useWallet();
  const config = useTryOnConfig();
  const [occasion, setOccasion] = useState<string>(OCCASIONS[0][1]);
  const [details, setDetails] = useState("");
  const [emptyCloset, setEmptyCloset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const startedAt = React.useRef(0);
  const typed = details.trim() ? `${occasion}. ${details.trim()}` : occasion;

  async function styleMe(closet: boolean, request = typed) {
    if (busy || saved.isPending || wallet.isPending) return;
    if (!saved.data) return router.push("/my-photo");
    if ((wallet.data?.available ?? 0) < 1) return outOfCredits();
    if (!(await agreedOnce(config.data?.provider ?? "the AI provider"))) return;
    startedAt.current = Date.now();
    setBusy(true);
    setError("");
    setEmptyCloset(false);
    try {
      const pick = await pickOutfit(request, styles, closet);
      if (!pick.outfit) return setEmptyCloset(true);
      analytics.track("stylist_styled", { from: closet ? "closet" : "ideas" });
      const person = await uploadPhoto(saved.data, "person");
      const { pieces, title } = pick.outfit;
      const result = await callTryOn<JobView>({
        action: "start",
        key: randomUUID(),
        person,
        outfit: pieces
          .map((p) => `${PART_LABEL[p.part]}: ${p.name}`)
          .join(". "),
        styled: { title, request, pieces },
        consent: "tryon-v1",
      });
      void askForNotifications();
      await client.invalidateQueries({ queryKey: ["wallet"] });
      await client.invalidateQueries({ queryKey: ["tryon-history"] });
      router.push({
        pathname: "/generation/[id]",
        params: { id: result.job.id, t: String(startedAt.current) },
      });
    } catch (e) {
      trackPhotoProblem(e);
      if (e instanceof Error && e.message === "NO_CREDITS") outOfCredits();
      else setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  // "Restyle from my closet" on a result: same occasion, from their closet.
  const restyle = params.closet === "1" && !!params.occasion;
  const ready = !!session && !saved.isPending && !wallet.isPending;
  useEffect(() => {
    if (restyle && ready) void styleMe(true, params.occasion);
    // Once, when the screen opens with the restyle request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restyle, ready]);

  return (
    <Page>
      <Modal visible={busy} animationType="fade" statusBarTranslucent>
        <CookingLoader
          fullScreen
          messages={MESSAGES}
          seconds={35}
          startedAt={startedAt.current}
        />
      </Modal>
      <FlatHeader title="AI Stylist" />
      <View style={{ padding: 20, gap: 18 }}>
        {!session ? (
          <Button
            title="Sign in to meet your stylist"
            onPress={() => router.push("/auth")}
          />
        ) : (
          <>
            <View style={card}>
              <Heading size={24}>What should I wear?</Heading>
              <Body style={{ fontSize: 14 }}>
                Tell me where you’re going. I’ll style a full outfit and show it
                on you.
              </Body>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {OCCASIONS.map(([chip, text]) => (
                  <Pressable
                    key={chip}
                    accessibilityRole="button"
                    accessibilityState={{ selected: occasion === text }}
                    onPress={() => setOccasion(text)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      borderRadius: 18,
                      backgroundColor:
                        occasion === text ? colors.ink : colors.cream,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: fonts.medium,
                        fontSize: 14,
                        color: occasion === text ? colors.white : colors.ink,
                      }}
                    >
                      {chip}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <TextInput
                accessibilityLabel="Details"
                value={details}
                onChangeText={setDetails}
                maxLength={150}
                placeholder="Details? e.g. summer day, streetwear vibe"
                placeholderTextColor={colors.placeholder}
                style={{
                  backgroundColor: colors.cream,
                  padding: 14,
                  borderRadius: 16,
                  fontFamily: fonts.body,
                  fontSize: 15,
                  color: colors.ink,
                }}
              />
              <Button
                icon="sparkles"
                title={
                  saved.data ? "Style me · 1 credit" : "Add your photo to start"
                }
                disabled={busy}
                onPress={() => void styleMe(false)}
              />
              <Button
                secondary
                icon="hanger"
                title="Style me from my closet"
                disabled={busy}
                onPress={() => void styleMe(true)}
              />
            </View>

            {emptyCloset && (
              <View style={card}>
                <Heading size={20}>Your closet is empty</Heading>
                <Body style={{ fontSize: 14 }}>
                  Add the clothes you already own, and I’ll style you from them.
                  No credit was used.
                </Body>
                <Button
                  secondary
                  icon="plus"
                  title="Add clothes you own"
                  onPress={() =>
                    router.push({
                      pathname: "/library-edit",
                      params: { kind: "wardrobe" },
                    })
                  }
                />
              </View>
            )}

            {!!error && (
              <Body
                style={{
                  padding: 16,
                  borderRadius: 18,
                  backgroundColor: colors.chip,
                }}
              >
                {error}
              </Body>
            )}
          </>
        )}
      </View>
    </Page>
  );
}
