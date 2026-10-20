import React, { useRef, useState } from "react";
import { View, TextInput, Pressable } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import {
  Body,
  Button,
  EmptyState,
  ErrorState,
  FlatHeader,
  Heading,
  LoadingSkeleton,
  Page,
} from "../src/components/ui";
import { useApp } from "../src/lib/state";
import { libraryPage } from "../src/lib/library";
import { useHistory } from "../src/lib/queries";
import { battleCall } from "../src/lib/battles";
import { analytics } from "../src/lib/analytics";
import { art } from "../src/data";
import { colors, fonts } from "../src/theme";
type Source = { id: string; kind: "library" | "job"; name: string };
export default function CreateBattle() {
  const { session } = useApp(),
    client = useQueryClient();
  const [title, setTitle] = useState("Which fit wins?"),
    [mode, setMode] = useState<"anonymous" | "public">("anonymous"),
    [side, setSide] = useState<"A" | "B">("A"),
    [a, setA] = useState<Source | null>(null),
    [b, setB] = useState<Source | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const nonce = useRef(randomUUID()),
    lock = useRef(false);
  const library = useInfiniteQuery({
    queryKey: ["battle-sources", session?.user.id],
    queryFn: ({ pageParam }) => libraryPage(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) =>
      page.length === 40
        ? `${page[39]!.created_at}|${page[39]!.id}`
        : undefined,
    enabled: !!session,
    refetchInterval: 240000,
  });
  const history = useHistory();
  function choose(source: Source) {
    if (busy) return;
    nonce.current = randomUUID();
    (side === "A" ? setA : setB)(source);
    if (side === "A") setSide("B");
    setError("");
  }
  async function preview() {
    if (lock.current || !a || !b) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await battleCall({
        action: "create",
        id: nonce.current,
        title,
        mode,
        aKind: a.kind,
        aId: a.id,
        bKind: b.kind,
        bId: b.id,
      });
      await client.invalidateQueries({ queryKey: ["battles"] });
      analytics.track(
        "battle_created",
        { voting_mode: mode },
        `battle:${result.id}`,
      );
      router.push({ pathname: "/battle/[id]", params: { id: result.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const items = (library.data?.pages.flat() ?? []).filter(
    (x) => x.photo_path || x.explore_image,
  );
  return (
    <Page>
      <FlatHeader title="Create a battle" pill="Private draft" />
      <View style={{ padding: 20, gap: 16 }}>
        {!session ? (
          <Button
            title="Sign in to create a battle"
            onPress={() => router.push("/auth")}
          />
        ) : (
          <>
            <Heading size={30}>Bring in the squad.</Heading>
            <Body>
              Choose two images you have permission to share. Preview privately
              before publishing. Creating a battle uses no AI credits.
            </Body>
            <Body>Battle title</Body>
            <TextInput
              accessibilityLabel="Battle title"
              value={title}
              onChangeText={(value) => {
                setTitle(value);
                nonce.current = randomUUID();
              }}
              editable={!busy}
              maxLength={100}
              style={{
                backgroundColor: colors.white,
                padding: 16,
                borderRadius: 18,
                fontFamily: fonts.body,
                fontSize: 17,
              }}
            />
            <Heading size={23}>Who can see the votes?</Heading>
            {(["anonymous", "public"] as const).map((value) => (
              <Button
                key={value}
                secondary={mode !== value}
                disabled={busy}
                title={`${mode === value ? "✓ " : ""}${value === "anonymous" ? "Anonymous votes" : "Public votes"}`}
                onPress={() => {
                  setMode(value);
                  nonce.current = randomUUID();
                }}
              />
            ))}
            <Body>
              {mode === "anonymous"
                ? "Anyone with the link can vote. Names are not displayed; totals are visible. Basic browser/account limits reduce repeat votes."
                : "Voters must sign in, choose a display name and agree that anyone with the link can see their name and choice. Display names are self-chosen, not verified identities."}{" "}
              This setting cannot change after the draft is created.
            </Body>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {(["A", "B"] as const).map((value) => (
                <Button
                  key={value}
                  style={{ flex: 1 }}
                  secondary={side !== value}
                  title={`Choose ${value}`}
                  disabled={busy}
                  onPress={() => setSide(value)}
                />
              ))}
            </View>
            <Body>
              Fit A: {a?.name ?? "Choose an image"}
              {"\n"}Fit B: {b?.name ?? "Choose a different image"}
            </Body>
            <Heading size={23}>From your Closet</Heading>
            {library.isPending ? (
              <LoadingSkeleton />
            ) : library.isError ? (
              <ErrorState
                message="Your images couldn’t load."
                retry={() => void library.refetch()}
              />
            ) : (
              <>
                {items.map((item) => {
                  const active = (side === "A" ? a : b)?.id === item.id,
                    other = side === "A" ? b : a;
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${item.name} for Fit ${side}`}
                      disabled={
                        busy ||
                        (other?.kind === "library" && other.id === item.id)
                      }
                      onPress={() =>
                        choose({
                          id: item.id,
                          kind: "library",
                          name: item.name,
                        })
                      }
                      style={{
                        backgroundColor: colors.white,
                        padding: 10,
                        borderRadius: 20,
                        borderWidth: 3,
                        borderColor: active ? colors.ink : colors.white,
                        flexDirection: "row",
                        gap: 14,
                        alignItems: "center",
                      }}
                    >
                      <Image
                        source={
                          item.photoUrl
                            ? { uri: item.photoUrl }
                            : art[item.explore_image!]
                        }
                        cachePolicy="none"
                        contentFit="contain"
                        style={{
                          width: 70,
                          height: 80,
                          borderRadius: 12,
                          backgroundColor: colors.chip,
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Heading size={18}>{item.name}</Heading>
                        <Body style={{ fontSize: 12 }}>
                          {item.explore_image && !item.photo_path
                            ? "Sample illustration"
                            : item.category}
                        </Body>
                      </View>
                    </Pressable>
                  );
                })}
                {!items.length && (
                  <EmptyState
                    title="Add a couple of looks."
                    message="Save samples from Explore or add your own images to Closet."
                    action="Open Closet"
                    onPress={() => router.push("/(tabs)/closet")}
                  />
                )}
                {library.hasNextPage && (
                  <Button
                    secondary
                    title={
                      library.isFetchingNextPage
                        ? "Loading…"
                        : "Load more Closet items"
                    }
                    disabled={library.isFetchingNextPage}
                    onPress={() => void library.fetchNextPage()}
                  />
                )}
              </>
            )}
            <Heading size={23}>Completed AI looks</Heading>
            <Body style={{ fontSize: 13 }}>
              The latest 50 try-ons. Only the generated result is copied; your
              original input photo stays private.
            </Body>
            {history.isError ? (
              <ErrorState
                message="AI looks couldn’t load."
                retry={() => void history.refetch()}
              />
            ) : (
              history.data
                ?.filter((job) => job.status === "completed")
                .map((job) => (
                  <Button
                    secondary
                    key={job.id}
                    disabled={
                      busy ||
                      ((side === "A" ? b : a)?.kind === "job" &&
                        (side === "A" ? b : a)?.id === job.id)
                    }
                    title={`Select AI preview · ${new Date(job.created_at).toLocaleString()}`}
                    onPress={() =>
                      choose({ id: job.id, kind: "job", name: "AI preview" })
                    }
                  />
                ))
            )}
            {!!error && <Body>{error}</Body>}
            <Button
              title={
                busy ? "Preparing private preview…" : "Preview private draft"
              }
              disabled={busy || !a || !b || !title.trim()}
              onPress={() => void preview()}
            />
            <Body style={{ fontSize: 13 }}>
              Only these two selected images are copied into the battle. Your
              other Closet items and input photos stay private. You will confirm
              public sharing on the next screen.
            </Body>
          </>
        )}
      </View>
    </Page>
  );
}
