import React, { useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import {
  Body,
  Button,
  FlatHeader,
  Heading,
  Page,
  SegmentedControl,
} from "../src/components/ui";
import { LookPicker } from "../src/components/LookPicker";
import { useApp } from "../src/lib/state";
import { battleCall, shareBattleLink } from "../src/lib/battles";
import { analytics } from "../src/lib/analytics";
import { askForNotifications } from "../src/lib/notifications";
import { colors, fonts } from "../src/theme";

const PROMPTS = {
  choose: [
    ["Date night 💕", "Date night — which one should I wear?"],
    ["Wedding 💍", "Wedding guest — which fit?"],
    ["Interview 💼", "Job interview — which one?"],
    ["Party 🎉", "Party tonight — pick my fit!"],
    ["Everyday ☀️", "Which one looks better on me?"],
  ],
  versus: [
    ["Who wore it better? 👀", "Who wore it better?"],
    ["Date night 💕", "Date night fit-off"],
    ["Party 🎉", "Party fit battle"],
  ],
} as const;

function Step({ n, title }: { n: number; title: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: colors.ink,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontFamily: fonts.bold, color: colors.yellow }}>
          {n}
        </Text>
      </View>
      <Heading size={20}>{title}</Heading>
    </View>
  );
}

export default function CreateBattle() {
  const params = useLocalSearchParams<{ kind?: string; look?: string }>();
  const versus = params.kind === "versus";
  const kind = versus ? "versus" : "choose";
  const { session } = useApp();
  const client = useQueryClient();
  // "Battle it" on a look in Closet arrives with it preselected.
  const [looks, setLooks] = useState<string[]>(
    params.look ? [params.look] : [],
  );
  const [title, setTitle] = useState<string>(PROMPTS[kind][0][1]);
  const [mode, setMode] = useState("Anonymous");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nonce = useRef(randomUUID());
  const ready = versus ? looks.length === 1 : looks.length >= 2;

  async function create() {
    if (busy || !ready || !title.trim()) return;
    setBusy(true);
    setError("");
    try {
      const id = nonce.current;
      await battleCall({
        action: "create",
        id,
        kind,
        title: title.trim(),
        mode: mode === "Public" ? "public" : "anonymous",
        sources: looks.map((look) => ({ kind: "job", id: look })),
      });
      // Tapping Share is the consent to show these looks to anyone with the link.
      await battleCall({ action: "publish", id, consent: true });
      await client.invalidateQueries({ queryKey: ["battles"] });
      analytics.track("battle_created", {
        voting_mode: mode === "Public" ? "public" : "anonymous",
      });
      void askForNotifications(); // to hear about votes and comments
      router.replace({ pathname: "/battle/[id]", params: { id } });
      await shareBattleLink(
        id,
        title.trim(),
        versus
          ? `I challenge you to a fit battle on Outfit League 👀 Join with your look:`
          : `${title.trim()} Vote for my fit 👇`,
      ).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
      nonce.current = randomUUID();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <FlatHeader title={versus ? "Battle a friend" : "Help me choose"} />
      <View style={{ padding: 20, gap: 18 }}>
        {!session ? (
          <Button
            title="Sign in to start a battle"
            onPress={() => router.push("/auth")}
          />
        ) : (
          <>
            <Step n={1} title={versus ? "Pick your look" : "Pick 2–4 looks"} />
            <LookPicker
              selected={looks}
              max={versus ? 1 : 4}
              onChange={setLooks}
            />
            <Step
              n={2}
              title={versus ? "Name the battle" : "Ask your friends"}
            />
            <TextInput
              accessibilityLabel="Battle question"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
              placeholder="Which one should I wear?"
              placeholderTextColor={colors.placeholder}
              style={{
                backgroundColor: colors.white,
                padding: 16,
                borderRadius: 18,
                fontFamily: fonts.body,
                fontSize: 16,
                color: colors.ink,
              }}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {PROMPTS[kind].map(([chip, text]) => (
                <Pressable
                  key={chip}
                  onPress={() => setTitle(text)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 18,
                    backgroundColor: title === text ? colors.ink : colors.white,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.medium,
                      fontSize: 14,
                      color: title === text ? colors.white : colors.ink,
                    }}
                  >
                    {chip}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Step n={3} title="Who sees the votes?" />
            <SegmentedControl
              options={["Anonymous", "Public"]}
              selected={mode}
              onChange={setMode}
            />
            <Body style={{ fontSize: 14 }}>
              {mode === "Public"
                ? "Voters sign in and their name shows next to their pick."
                : "Anyone with the link can vote. Only totals are shown."}
            </Body>
            {!!error && <Body style={{ color: colors.ink }}>{error}</Body>}
            <Button
              icon="share"
              title={
                busy
                  ? "Getting it ready…"
                  : versus
                    ? "Send invite"
                    : "Share with friends"
              }
              disabled={busy || !ready || !title.trim()}
              onPress={() => void create()}
            />
            <Body style={{ fontSize: 12, textAlign: "center" }}>
              {versus
                ? "Anyone with the link can see your look, name and profile photo."
                : "Anyone with the link can see these looks."}
            </Body>
          </>
        )}
      </View>
    </Page>
  );
}
