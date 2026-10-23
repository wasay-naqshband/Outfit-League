import React, { useEffect, useRef, useState } from "react";
import { analytics } from "../../src/lib/analytics";
import { Alert, Modal, Platform, View } from "react-native";
import * as SecureStore from "expo-secure-store";
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
  Page,
  SettingsButton,
} from "../../src/components/ui";
import { PhotoPickerCard } from "../../src/components/PhotoPickerCard";
import { PieceSheet } from "../../src/components/PieceSheet";
import {
  CookingLoader,
  TRYON_MESSAGES,
} from "../../src/components/CookingLoader";
import { colors, gradients } from "../../src/theme";
import { useApp } from "../../src/lib/state";
import { useTryOnDraft } from "../../src/lib/tryon-draft";
import {
  useHistory,
  useSavedPhoto,
  useTryOnConfig,
  useWallet,
} from "../../src/lib/queries";
import { pickPhoto, preparePhoto } from "../../src/lib/photos";
import {
  callTryOn,
  fetchWallet,
  fetchHistory,
  imageFromLink,
  uploadPhoto,
} from "../../src/lib/tryon-api";
import { friendlyError, isTerminal } from "../../src/types/tryon";
import type { JobView } from "../../src/types/tryon";

const CONSENT_KEY = "outfit-league-tryon-consent-v1";
// Photos go to a third-party AI provider, so ask once per device, then remember.
async function agreedOnce(provider: string) {
  const prior = await (async () =>
    Platform.OS === "web"
      ? localStorage.getItem(CONSENT_KEY)
      : SecureStore.getItemAsync(CONSENT_KEY))().catch(() => null);
  if (prior === "yes") return true;
  const text = `I’m 18+ and have permission to use these photos. They’re sent privately to ${provider} to make the try-on. Nothing is posted publicly.`;
  const ok = await new Promise<boolean>((resolve) =>
    Platform.OS === "web"
      ? resolve(window.confirm(text))
      : Alert.alert("Before your first try-on", text, [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          { text: "I agree", onPress: () => resolve(true) },
        ]),
  );
  if (ok)
    await (
      Platform.OS === "web"
        ? Promise.resolve(localStorage.setItem(CONSENT_KEY, "yes"))
        : SecureStore.setItemAsync(CONSENT_KEY, "yes")
    ).catch(() => {});
  return ok;
}

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
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const attempt = useRef<Attempt | null>(null);
  const submitted = useRef(false);
  const startedAt = useRef(0);
  const active = history.data?.find((job) => !isTerminal(job.status));
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
      router.push({ pathname: "/paywall", params: { source: "credits" } });
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
      await queryClient.invalidateQueries({ queryKey: ["wallet"] });
      await queryClient.invalidateQueries({ queryKey: ["tryon-history"] });
      attempt.current = null;
      draft.clear();
      router.push({
        pathname: "/generation/[id]",
        params: { id: result.job.id, t: String(startedAt.current) },
      });
    } catch (e) {
      setError(friendlyError(e));
      void history.refetch();
      void wallet.refetch();
    } finally {
      submitted.current = false;
      setBusy(false);
      setStage("");
    }
  }
  return (
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
          gap: 20,
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <CreditPill compact />
            <SettingsButton />
          </View>
        </View>
        <Heading size={34}>Try any outfit on yourself.</Heading>
      </LinearGradient>
      <View style={{ padding: 20, gap: 16 }}>
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
        <Body>
          Choose a clear full-length photo of yourself, then any top, bottoms,
          jacket or dress. Add a photo or paste a link from any store.
        </Body>
        <View style={{ flexDirection: "row", gap: 12 }}>
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
            label="Clothing item"
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
        </View>
        {sheetBusy && !sheet && <Body>Getting the item from your link…</Body>}
        {!session && (
          <Button
            secondary
            title="Sign in for a real try-on"
            onPress={() => router.push("/auth")}
          />
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
        <Button
          icon="sparkles"
          title={
            busy
              ? stage
              : wallet.data?.available === 0
                ? "Get more try-ons"
                : "Generate try-on · 1 credit"
          }
          disabled={
            busy ||
            !session ||
            !!active ||
            (!outOfCredits &&
              (!config.data?.enabled || !draft.person || !draft.garment))
          }
          onPress={() => {
            void generate();
          }}
        />
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
          router.push({ pathname: "/paywall", params: { source: "feature" } });
        }}
        onLink={(url) => void useLink(url)}
      />
    </Page>
  );
}
