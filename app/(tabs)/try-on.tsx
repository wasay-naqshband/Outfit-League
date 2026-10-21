import React, { useRef, useState } from "react";
import { analytics } from "../../src/lib/analytics";
import { Platform, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { randomUUID } from "expo-crypto";
import { useQueryClient } from "@tanstack/react-query";
import {
  Body,
  Button,
  CreditPill,
  DemoNote,
  Heading,
  Icon,
  OutfitCard,
  Page,
  SettingsButton,
} from "../../src/components/ui";
import { PhotoPickerCard } from "../../src/components/PhotoPickerCard";
import { getOutfit } from "../../src/data";
import { colors, fonts, gradients } from "../../src/theme";
import { useApp } from "../../src/lib/state";
import { useTryOnDraft } from "../../src/lib/tryon-draft";
import { useHistory, useTryOnConfig, useWallet } from "../../src/lib/queries";
import { pickPhoto } from "../../src/lib/photos";
import { callTryOn, fetchHistory, uploadPhoto } from "../../src/lib/tryon-api";
import { friendlyError, isTerminal } from "../../src/types/tryon";
import type { JobView } from "../../src/types/tryon";

type Attempt = {
  key: string;
  person?: string;
  garment?: string;
  started?: boolean;
};
export default function TryOn() {
  const { look } = useLocalSearchParams<{ look?: string }>();
  const item = getOutfit(look);
  const { session } = useApp();
  const draft = useTryOnDraft();
  const config = useTryOnConfig();
  const wallet = useWallet();
  const history = useHistory();
  const queryClient = useQueryClient();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const attempt = useRef<Attempt | null>(null);
  const submitted = useRef(false);
  const active = history.data?.find((job) => !isTerminal(job.status));
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
      setConsent(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "We couldn’t open your photos.",
      );
    }
  }
  async function remove(kind: "person" | "garment") {
    try {
      if (!(await discardAttempt())) return;
      (kind === "person" ? draft.setPerson : draft.setGarment)(null);
      setConsent(false);
    } catch {
      setError("Please check your connection before replacing these photos.");
    }
  }
  async function generate() {
    if (submitted.current || !draft.person || !draft.garment || !consent)
      return;
    if (!session) {
      router.push("/auth");
      return;
    }
    if (!config.data?.enabled) return;
    submitted.current = true;
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
      setConsent(false);
      router.push({
        pathname: "/generation/[id]",
        params: { id: result.job.id },
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
        <Body>Your next fit starts with two photos.</Body>
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
          Your selections stay on this device until you generate.
        </Body>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <PhotoPickerCard
            label="Your photo"
            photo={draft.person}
            disabled={busy}
            onChoose={() => {
              void select("person");
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
        <Button
          secondary
          icon="hanger"
          title="Choose from your Closet"
          disabled={busy}
          onPress={() => router.push("/(tabs)/closet")}
        />
        {Platform.OS !== "web" && (
          <Button
            secondary
            title="Take your photo"
            icon="image"
            disabled={busy}
            onPress={() => {
              void select("person", true);
            }}
          />
        )}
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent, disabled: busy }}
          disabled={busy}
          onPress={() => setConsent(!consent)}
          style={{
            flexDirection: "row",
            gap: 12,
            alignItems: "flex-start",
            minHeight: 44,
            paddingVertical: 8,
          }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderWidth: 2,
              borderColor: colors.ink,
              borderRadius: 7,
              backgroundColor: consent ? colors.ink : colors.white,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {consent && <Icon name="check" size={18} color={colors.yellow} />}
          </View>
          <Text
            style={{
              flex: 1,
              fontFamily: fonts.body,
              fontSize: 14,
              lineHeight: 20,
              color: colors.text2,
            }}
          >
            I’m 18+ and have permission to use these photos. Generating uploads
            them privately and sends them to{" "}
            {config.data?.provider ?? "the AI provider"} for processing. Nothing
            is posted publicly.
            {config.data?.provider === "Genlook" &&
              " Genlook receives both photos and creates a hosted result. We request one-day retention; deleting here removes Outfit League’s copies."}
          </Text>
        </Pressable>
        {!session && (
          <Button
            secondary
            title="Sign in for a real try-on"
            onPress={() => router.push("/auth")}
          />
        )}
        {session && !config.isPending && !config.data?.enabled && (
          <Body>
            Live generation isn’t connected yet. Your selected photos stay
            local; the sample result below is still available.
          </Body>
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
            !consent ||
            !!active ||
            wallet.data?.available === 0
          }
          onPress={() => {
            void generate();
          }}
        />
        <Body style={{ fontSize: 13 }}>
          One credit is used only for a successful preview. This visualizes
          style, not physical fit or sizing. You can delete your photos and
          results from Recent try-ons.
        </Body>
        {session && (
          <Button
            secondary
            title="Recent try-ons"
            onPress={() => router.push("/history")}
          />
        )}
        <Heading size={22}>
          {look ? "Your selected inspiration" : "Explore a sample result"}
        </Heading>
        {look && (
          <Body style={{ fontSize: 13 }}>
            This inspiration is a sample illustration. For a real try-on, choose
            a photo of a single supported garment above.
          </Body>
        )}
        <OutfitCard
          outfit={item}
          height={215}
          label
          onTry={() =>
            router.push({ pathname: "/result", params: { look: item.id } })
          }
          onPress={() =>
            router.push({ pathname: "/result", params: { look: item.id } })
          }
        />
        <Button
          secondary
          title="View demo result"
          onPress={() =>
            router.push({ pathname: "/result", params: { look: item.id } })
          }
        />
        <DemoNote text="The demo uses supplied artwork, never your selected photo." />
      </View>
    </Page>
  );
}
