import React, { useEffect, useRef, useState } from "react";
import { analytics, trackPhotoProblem } from "../../src/lib/analytics";
import { askForNotifications } from "../../src/lib/notifications";
import { Alert, Modal, Platform, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { clearSharedPayloads, getSharedPayloads } from "expo-sharing";
import { LinearGradient } from "expo-linear-gradient";
import { randomUUID } from "expo-crypto";
import { useQueryClient } from "@tanstack/react-query";
import {
  Body,
  Button,
  CreditPill,
  Heading,
  Icon,
  Page,
  SettingsButton,
} from "../../src/components/ui";
import { StickerTag, TactileButton } from "../../src/components/Redesign";
import { PhotoPickerCard } from "../../src/components/PhotoPickerCard";
import { PieceSheet } from "../../src/components/PieceSheet";
import {
  CookingLoader,
  TRYON_MESSAGES,
} from "../../src/components/CookingLoader";
import { colors, fonts, gradients } from "../../src/theme";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../src/lib/state";
import { useTryOnDraft } from "../../src/lib/tryon-draft";
import {
  useHistory,
  useJob,
  useSavedPhoto,
  useTryOnConfig,
  useWallet,
} from "../../src/lib/queries";
import { pickPhoto, preparePhoto } from "../../src/lib/photos";
import { saveSavedPhoto } from "../../src/lib/saved-photo";
import {
  callTryOn,
  fetchWallet,
  fetchHistory,
  imageFromLink,
  uploadPhoto,
} from "../../src/lib/tryon-api";
import { friendlyError, isTerminal } from "../../src/types/tryon";
import { outOfCredits as creditsAlert } from "../../src/lib/credits";
import { agreedOnce } from "../../src/lib/consent";
import type { JobView } from "../../src/types/tryon";

type Attempt = {
  key: string;
  person?: string;
  garment?: string;
  started?: boolean;
};
export default function TryOn() {
  const { session } = useApp();
  const draft = useTryOnDraft();
  const config = useTryOnConfig();
  const wallet = useWallet();
  const history = useHistory();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const attempt = useRef<Attempt | null>(null);
  const submitted = useRef(false);
  const startedAt = useRef(0);
  const active = history.data?.find((job) => !isTerminal(job.status));
  const latest = history.data?.find((job) => job.status === "completed");
  const latestView = useJob(latest?.id);
  const outOfCredits = wallet.data?.available === 0;
  const saved = useSavedPhoto();
  const removed = useRef(false);
  const [sheet, setSheet] = useState(false);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [sheetError, setSheetError] = useState("");
  const shared = useLocalSearchParams<{ shared?: string }>().shared;
  // Shared from another app (Safari, Instagram, a store app): a screenshot or
  // a product link becomes the top.
  useEffect(() => {
    if (!shared || Platform.OS === "web") return;
    let payloads: ReturnType<typeof getSharedPayloads>;
    try {
      payloads = getSharedPayloads();
    } catch {
      return;
    }
    const image = payloads.find((p) => p.shareType === "image")?.value;
    const text =
      payloads.find((p) => p.shareType === "url" || p.shareType === "text")
        ?.value ?? "";
    const link = text.match(/https?:\/\/\S+/i)?.[0];
    const file = image && /^(file|content):\/\//.test(image) ? image : null;
    if (!file && !link) return;
    if (!file && !session) {
      setError("Sign in, then share the link again to try it on.");
      return;
    }
    setError("");
    setSheetBusy(true);
    void (async () => {
      try {
        if (link && !file) {
          const currentWallet = await fetchWallet();
          if (!currentWallet.subscription_active) {
            setError(
              "Importing store links is a Pro feature. Free photo imports still work.",
            );
            router.push({
              pathname: "/paywall",
              params: { source: "feature" },
            });
            return;
          }
        }
        const photo = file
          ? await preparePhoto(file)
          : await imageFromLink(link!);
        if (await discardAttempt()) draft.setGarment(photo);
        clearSharedPayloads();
      } catch (e) {
        setError(friendlyError(e));
      } finally {
        setSheetBusy(false);
      }
    })();
  }, [shared]);
  // Keep the saved try-on photo in place (also after a try-on clears the
  // draft) unless the person removed it here.
  useEffect(() => {
    if (!draft.person && saved.data && !removed.current)
      draft.setPerson(saved.data);
  }, [saved.data, draft.person]);
  // A photo added before signing in (e.g. during onboarding) becomes the
  // account's default try-on photo once there's an account and no default yet.
  useEffect(() => {
    const owner = session?.user.id;
    const photo = draft.person;
    if (!owner || !photo || !saved.isSuccess || saved.data) return;
    void saveSavedPhoto(owner, photo)
      .then(() => queryClient.setQueryData(["saved-photo", owner], photo))
      .catch(() => {});
  }, [session?.user.id, saved.isSuccess, saved.data, draft.person]);
  // The person photo can change from the My photo screen; drop an upload made
  // for the previous one so it is never reused.
  useEffect(() => {
    const current = attempt.current;
    if (current?.person && !current.started) {
      void callTryOn({ action: "remove-upload", id: current.person }).catch(
        () => {},
      );
      current.person = undefined;
    }
  }, [draft.person]);
  async function discardAttempt() {
    const current = attempt.current;
    if (current?.started) {
      const jobs = await fetchHistory();
      const running = jobs.find((job) => !isTerminal(job.status));
      if (running) {
        router.push({
          pathname: "/generation/[id]",
          params: { id: running.id },
        });
        return false;
      }
    }
    if (current && !current.started) {
      await Promise.all(
        [current.person, current.garment]
          .filter(Boolean)
          .map((id) =>
            callTryOn({ action: "remove-upload", id }).catch(() => {}),
          ),
      );
    }
    attempt.current = null;
    return true;
  }
  async function choosePhoto() {
    setSheet(false);
    setError("");
    // Let the sheet close before the system photo picker opens over it.
    await new Promise((resolve) => setTimeout(resolve, 350));
    try {
      const photo = await pickPhoto();
      if (!photo) return;
      if (!(await discardAttempt())) return;
      draft.setGarment(photo);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "We couldn’t open your photos.",
      );
    }
  }
  async function useLink(url: string) {
    if (!session) {
      setSheetError("Sign in to try on clothes from a store link.");
      return;
    }
    try {
      const currentWallet = await fetchWallet();
      if (!currentWallet.subscription_active) {
        setSheet(false);
        router.push({ pathname: "/paywall", params: { source: "feature" } });
        return;
      }
    } catch {
      setSheetError("We couldn’t verify your plan. Please try again.");
      return;
    }
    setSheetBusy(true);
    setSheetError("");
    try {
      const photo = await imageFromLink(url);
      if (!(await discardAttempt())) return;
      draft.setGarment(photo);
      setSheet(false);
    } catch (e) {
      setSheetError(friendlyError(e));
    } finally {
      setSheetBusy(false);
    }
  }
  async function remove(kind: "person" | "garment") {
    try {
      if (!(await discardAttempt())) return;
      if (kind === "person") {
        removed.current = true;
        draft.setPerson(null);
      } else draft.setGarment(null);
    } catch {
      setError("Please check your connection before replacing these photos.");
    }
  }
  async function generate() {
    if (submitted.current) return;
    if (!session) {
      router.push("/auth");
      return;
    }
    if (outOfCredits) {
      creditsAlert();
      return;
    }
    if (!draft.person || !draft.garment) return;
    if (!config.data?.enabled) return;
    if (!(await agreedOnce(config.data.provider ?? "the AI provider"))) return;
    submitted.current = true;
    startedAt.current = Date.now();
    setBusy(true);
    setError("");
    const current = attempt.current ?? { key: randomUUID() };
    attempt.current = current;
    try {
      setStage("Uploading your private photos…");
      if (!current.person)
        current.person = await uploadPhoto(draft.person, "person");
      if (!current.garment)
        current.garment = await uploadPhoto(draft.garment, "garment");
      setStage("Starting your try-on…");
      current.started = true;
      const result = await callTryOn<JobView>({
        action: "start",
        key: current.key,
        person: current.person,
        garment: current.garment,
        consent: "tryon-v1",
      });
      analytics.track(
        "try_on_started",
        { mode: "live" },
        `start:${result.job.id}`,
      );
      // The natural moment to offer a "your look is ready" ping.
      void askForNotifications();
      await queryClient.invalidateQueries({ queryKey: ["wallet"] });
      await queryClient.invalidateQueries({ queryKey: ["tryon-history"] });
      attempt.current = null;
      draft.clear();
      router.push({
        pathname: "/generation/[id]",
        params: { id: result.job.id, t: String(startedAt.current) },
      });
    } catch (e) {
      trackPhotoProblem(e);
      if (e instanceof Error && e.message === "NO_CREDITS") creditsAlert();
      else setError(friendlyError(e));
      void history.refetch();
      void wallet.refetch();
    } finally {
      submitted.current = false;
      setBusy(false);
      setStage("");
    }
  }
  return (
    <View style={{ flex: 1 }}>
      <Page>
        {/* Full-screen wait from the first tap: uploads and start run underneath. */}
        <Modal visible={busy} animationType="fade" statusBarTranslucent>
          <CookingLoader
            fullScreen
            messages={TRYON_MESSAGES}
            seconds={25}
            startedAt={startedAt.current}
          />
        </Modal>
        <LinearGradient
          colors={gradients.yellow}
          style={{
            padding: 20,
            paddingTop: 28,
            gap: 18,
            borderBottomLeftRadius: 36,
            borderBottomRightRadius: 36,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Heading size={26}>Try On</Heading>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <CreditPill compact />
              <SettingsButton />
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Heading size={32}>Try any outfit</Heading>
            <StickerTag size={22}>on you.</StickerTag>
          </View>
        </LinearGradient>
        <View style={{ padding: 20, paddingBottom: 190, gap: 18 }}>
          {active && (
            <Button
              title="Resume your current try-on"
              icon="sparkles"
              onPress={() =>
                router.push({
                  pathname: "/generation/[id]",
                  params: { id: active.id },
                })
              }
            />
          )}
          <View style={{ position: "relative", flexDirection: "row", gap: 12 }}>
            <PhotoPickerCard
              label="Your photo"
              photo={draft.person}
              disabled={busy}
              onChoose={() => {
                router.push("/my-photo");
              }}
              onRemove={() => {
                void remove("person");
              }}
            />
            <PhotoPickerCard
              label="The fit"
              photo={draft.garment}
              disabled={busy || sheetBusy}
              onChoose={() => {
                setSheetError("");
                setSheet(true);
              }}
              onRemove={() => {
                void remove("garment");
              }}
            />
            <View
              accessible={false}
              pointerEvents="none"
              style={{
                position: "absolute",
                zIndex: 2,
                left: "50%",
                top: 98,
                marginLeft: -24,
                width: 48,
                height: 48,
                borderRadius: 24,
                borderWidth: 3,
                borderColor: colors.ink,
                backgroundColor: colors.yellow,
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0px 4px 0px #14121F",
              }}
            >
              <Icon name="plus" size={24} />
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Paste a link from any store"
            onPress={() => {
              setSheetError("");
              setSheet(true);
            }}
            style={{
              minHeight: 48,
              alignSelf: "center",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <Icon name="link" size={20} />
            <Text
              style={{
                color: colors.ink,
                fontFamily: fonts.bold,
                fontSize: 16,
                textDecorationLine: "underline",
              }}
            >
              Or paste a link from any store
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole={latest ? "button" : undefined}
            accessibilityLabel={latest ? "Open your latest try-on" : undefined}
            disabled={!latest}
            onPress={() =>
              latest &&
              router.push({
                pathname: "/generation/[id]",
                params: { id: latest.id },
              })
            }
            style={{
              minHeight: 96,
              borderRadius: 28,
              padding: 12,
              backgroundColor: colors.ink,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              boxShadow: "0px 12px 26px rgba(20,18,31,0.2)",
            }}
          >
            <View
              style={{
                width: 58,
                height: 70,
                borderRadius: 20,
                overflow: "hidden",
                backgroundColor: "#38324F",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {latestView.data?.afterUrl ? (
                <Image
                  source={{ uri: latestView.data.afterUrl }}
                  contentFit="cover"
                  style={{ width: "100%", height: "100%" }}
                  accessibilityLabel="Latest try-on result"
                />
              ) : (
                <Icon name="sparkles" size={24} color={colors.yellow} />
              )}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Heading size={18} style={{ color: colors.white }}>
                {latest ? "Your latest look" : "Your look lands here"}
              </Heading>
              <Body style={{ color: "#D9D6E3", fontSize: 13 }}>
                {latest
                  ? "Tap to open your finished try-on."
                  : "Then save it, battle it or shop it."}
              </Body>
            </View>
            {latest && <Icon name="chevron-right" color={colors.white} />}
          </Pressable>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {["Full-length", "Good light", "One item"].map((tip) => (
              <View
                key={tip}
                style={{
                  minHeight: 42,
                  paddingHorizontal: 12,
                  borderRadius: 22,
                  backgroundColor: colors.white,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Icon name="check" size={17} color="#127A55" />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13 }}>
                  {tip}
                </Text>
              </View>
            ))}
          </View>
          {sheetBusy && !sheet && <Body>Getting the item from your link…</Body>}
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
        <PieceSheet
          visible={sheet}
          busy={sheetBusy}
          error={sheetError}
          onClose={() => setSheet(false)}
          onPhoto={() => void choosePhoto()}
          proEnabled={wallet.data?.subscription_active ?? false}
          onPro={() => {
            setSheet(false);
            router.push({
              pathname: "/paywall",
              params: { source: "feature" },
            });
          }}
          onLink={(url) => void useLink(url)}
        />
      </Page>
      <View
        style={{
          position: "absolute",
          left: 20,
          right: 20,
          bottom: Math.max(92, insets.bottom + 76),
        }}
      >
        <TactileButton
          icon={outOfCredits ? "sparkles" : "camera"}
          title={
            busy
              ? stage
              : !session
                ? "Sign in to try on"
                : outOfCredits
                  ? "Get more try-ons"
                  : "Generate try-on · 1 credit"
          }
          disabled={
            busy ||
            !!active ||
            (Boolean(session) &&
              !outOfCredits &&
              (!config.data?.enabled || !draft.person || !draft.garment))
          }
          onPress={() => {
            if (!session) router.push("/auth");
            else void generate();
          }}
        />
      </View>
    </View>
  );
}
