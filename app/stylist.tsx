import React, { useEffect, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { randomUUID } from "expo-crypto";
import { useQueryClient } from "@tanstack/react-query";
import {
  Body,
  CreditPill,
  Heading,
  Icon,
  Page,
  RoundButton,
} from "../src/components/ui";
import {
  StickerTag,
  StylistExampleCard,
  TactileButton,
} from "../src/components/Redesign";
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
import { colors, fonts, gradients, shadow } from "../src/theme";

const OCCASIONS = [
  {
    id: "hangout",
    label: "Hangout",
    prompt: "A casual hangout",
    icon: "coffee",
  },
  {
    id: "weekend",
    label: "Weekend",
    prompt: "A relaxed weekend",
    icon: "home",
  },
  {
    id: "date_night",
    label: "Date night",
    prompt: "A date night",
    icon: "heart",
  },
  { id: "work", label: "Work", prompt: "A day at work", icon: "briefcase" },
  { id: "party", label: "Party", prompt: "A party", icon: "gift" },
  { id: "travel", label: "Travel", prompt: "A travel outfit", icon: "map" },
] as const;
// One wait for both steps: writing the outfit, then dressing their photo.
const MESSAGES = [
  "Reading the room… 👀",
  "Pulling pieces from every rail…",
  "Balancing colours and layers…",
  ...TRYON_MESSAGES,
];
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
  const [occasion, setOccasion] = useState<string>(OCCASIONS[0].prompt);
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

  const credits = wallet.data?.available ?? 0;
  const primaryLabel = !session
    ? "Add your photo to start"
    : !saved.data
      ? "Add your photo to start"
      : credits < 1
        ? "Get more try-ons"
        : "Style my outfit";

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
      <LinearGradient
        colors={gradients.yellow}
        style={{
          paddingHorizontal: 20,
          paddingTop: 22,
          paddingBottom: 26,
          gap: 14,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
          ...shadow(0.1),
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <RoundButton
            name="arrow-left"
            label="Back"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/(tabs)")
            }
          />
          <Heading size={28} style={{ flex: 1 }}>
            AI Stylist
          </Heading>
          <CreditPill compact />
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <Heading size={30}>What should I wear?</Heading>
          <StickerTag>Sorted.</StickerTag>
        </View>
      </LinearGradient>
      <View style={{ padding: 20, gap: 18 }}>
        <StylistExampleCard />
        <Heading size={19}>Where are you off to?</Heading>
        <View
          accessibilityRole="radiogroup"
          style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
        >
          {OCCASIONS.map((option) => {
            const selected = occasion === option.prompt;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={option.label}
                onPress={() => setOccasion(option.prompt)}
                style={{
                  width: "31.8%",
                  minHeight: 68,
                  borderRadius: 18,
                  backgroundColor: selected ? colors.ink : colors.white,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  ...shadow(selected ? 0.18 : 0.06),
                }}
              >
                <Icon
                  name={option.icon as "coffee"}
                  color={selected ? colors.yellow : colors.ink}
                  size={21}
                />
                <Text
                  style={{
                    fontFamily: selected ? fonts.bold : fonts.medium,
                    fontSize: 13,
                    color: selected ? colors.white : colors.ink,
                  }}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View
          style={{
            minHeight: 52,
            paddingHorizontal: 16,
            borderRadius: 18,
            backgroundColor: colors.white,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            ...shadow(0.06),
          }}
        >
          <Icon name="edit-2" size={18} color={colors.text3} />
          <TextInput
            accessibilityLabel="Outfit details"
            value={details}
            onChangeText={setDetails}
            maxLength={150}
            placeholder="Any details? Hot day, streetwear vibe..."
            placeholderTextColor={colors.text3}
            style={{
              flex: 1,
              minWidth: 0,
              paddingVertical: 12,
              fontFamily: fonts.body,
              fontSize: 15,
              color: colors.ink,
              outlineStyle: "none" as never,
            }}
          />
        </View>
        <TactileButton
          icon={
            !session || !saved.data
              ? "camera"
              : credits < 1
                ? "sparkles"
                : "sparkles"
          }
          title={primaryLabel}
          disabled={busy || saved.isPending || wallet.isPending}
          onPress={() => {
            if (!session) router.push("/auth");
            else if (!saved.data) router.push("/my-photo");
            else if (credits < 1) outOfCredits();
            else void styleMe(false);
          }}
        />
        <TactileButton
          secondary
          icon="hanger"
          title="Style me from my closet"
          disabled={busy || !session}
          onPress={() => void styleMe(true)}
        />
        {!session && (
          <Body style={{ textAlign: "center", fontSize: 13 }}>
            Sign in to use your photo and save your stylist looks.
          </Body>
        )}

        {emptyCloset && (
          <View
            style={{
              backgroundColor: colors.white,
              borderRadius: 28,
              padding: 20,
              gap: 14,
            }}
          >
            <Heading size={20}>Your closet is empty</Heading>
            <Body style={{ fontSize: 14 }}>
              Add the clothes you already own, and I’ll style you from them. No
              credit was used.
            </Body>
            <TactileButton
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
      </View>
    </Page>
  );
}
