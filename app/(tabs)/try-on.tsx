import React, { useEffect, useRef, useState } from "react";
import { analytics } from "../../src/lib/analytics";
import { Alert, Modal, Platform, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
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
import { pickPhoto } from "../../src/lib/photos";
import { callTryOn, fetchHistory, uploadPhoto } from "../../src/lib/tryon-api";
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
  const saved = useSavedPhoto();
  const removed = useRef(false);
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
  async function select(kind: "person" | "garment", camera = false) {
    if (busy) return;
    setError("");
    try {
      const photo = await pickPhoto(camera);
      if (!photo) return;
      if (!(await discardAttempt())) return;
      (kind === "person" ? draft.setPerson : draft.setGarment)(photo);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "We couldn’t open your photos.",
      );
    }
  }
  async function remove(kind: "person" | "garment") {
    try {
      if (!(await discardAttempt())) return;
      if (kind === "person") removed.current = true;
      (kind === "person" ? draft.setPerson : draft.setGarment)(null);
    } catch {
      setError("Please check your connection before replacing these photos.");
    }
  }
  async function generate() {
    if (submitted.current || !draft.person || !draft.garment) return;
    if (!session) {
      router.push("/auth");
      return;
    }
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
          Choose a clear photo of yourself and one top, shirt, hoodie or jacket.
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
            disabled={busy}
            onChoose={() => {
              void select("garment");
            }}
            onRemove={() => {
              void remove("garment");
            }}
          />
        </View>
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
          title={busy ? stage : "Generate try-on · 1 credit"}
          disabled={
            busy ||
            !session ||
            !config.data?.enabled ||
            !draft.person ||
            !draft.garment ||
            !!active ||
            wallet.data?.available === 0
          }
          onPress={() => {
            void generate();
          }}
        />
      </View>
    </Page>
  );
}
