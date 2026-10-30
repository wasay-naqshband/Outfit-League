import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Body,
  Button,
  ErrorState,
  FlatHeader,
  Heading,
  Icon,
  LoadingSkeleton,
  Page,
} from "../../src/components/ui";
import { BattleCards } from "../../src/components/BattleCards";
import { LookPicker } from "../../src/components/LookPicker";
import { Avatar } from "../../src/components/Avatar";
import {
  FitPicker,
  GetTheApp,
  ScoreBar,
  Switch,
  VoteHeader,
  VoterChips,
  hard,
} from "../../src/components/BattleVote";
import {
  battleCall,
  copyBattleLink,
  shareBattleLink,
  whatsappBattleLink,
  shareBattleComment,
  rememberBattleReturn,
  type BattleView,
  type Side,
} from "../../src/lib/battles";
import { useApp } from "../../src/lib/state";
import { useProfile } from "../../src/lib/queries";
import { analytics } from "../../src/lib/analytics";
import { colors, fonts } from "../../src/theme";

const NAME_KEY = "outfit-league-voter-name";
const card: ViewStyle = {
  backgroundColor: colors.white,
  borderRadius: 28,
  padding: 16,
  gap: 12,
  shadowColor: colors.ink,
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 12 },
  elevation: 3,
};
const input: TextStyle = {
  flex: 1,
  height: 52,
  backgroundColor: "#FFF8D9",
  borderRadius: 18,
  paddingHorizontal: 16,
  fontFamily: fonts.body,
  fontSize: 16,
  color: colors.ink,
};
const errorText: TextStyle = {
  fontFamily: fonts.medium,
  fontSize: 13,
  color: "#B3301C",
};
const ago = (at: string) => {
  const m = Math.max(1, Math.round((Date.now() - Date.parse(at)) / 60000));
  return m < 60
    ? `${m}m`
    : m < 1440
      ? `${Math.round(m / 60)}h`
      : `${Math.round(m / 1440)}d`;
};

function RoundAction({
  icon,
  label,
  onPress,
}: {
  icon: "whatsapp" | "copy";
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: icon === "whatsapp" ? "#25D366" : colors.white,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon
        name={icon}
        size={24}
        color={icon === "whatsapp" ? colors.white : colors.ink}
      />
    </Pressable>
  );
}

function TextLink({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{ padding: 8 }}
    >
      <Text
        style={{
          fontFamily: fonts.medium,
          fontSize: 14,
          color: colors.text3,
          textAlign: "center",
          textDecorationLine: "underline",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function Pill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: colors.cream,
      }}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function BattleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, ready } = useApp();
  const profile = useProfile();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["battle", session?.user.id, id],
    queryFn: () => battleCall({ action: "view", id }),
    enabled: ready && !!id,
    refetchInterval: 15000,
  });
  const [choice, setChoice] = useState<Side | null>(null);
  const [pick, setPick] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [comment, setComment] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [more, setMore] = useState(false);
  const [reporting, setReporting] = useState(false);
  // Comment menu (report / block) and which comments this person reported.
  const [menu, setMenu] = useState<number | null>(null);
  const [reported, setReported] = useState<number[]>([]);
  const [stopping, setStopping] = useState(false);
  const [copied, setCopied] = useState(false);
  const [allComments, setAllComments] = useState(false);
  const nameField = useRef<TextInput>(null);
  // Which action the current message belongs to, so errors show beside it.
  const last = useRef("");
  const lock = useRef(false);
  const battle = query.data;
  useEffect(() => {
    if (profile.data?.name) setName(profile.data.name);
  }, [profile.data?.name]);
  // Web visitors: remember the name for comments and repeat visits.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    try {
      const saved = localStorage.getItem(NAME_KEY);
      if (saved) setName((n) => n || saved);
    } catch {
      /* storage blocked: they type it again */
    }
  }, []);
  useEffect(() => {
    if (Platform.OS !== "web" || name.trim().length < 2) return;
    try {
      localStorage.setItem(NAME_KEY, name.trim());
    } catch {
      /* storage blocked */
    }
  }, [name]);

  async function action(type: string, fields: Record<string, unknown> = {}) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await battleCall<BattleView>({
        action: type,
        id,
        ...fields,
      });
      client.setQueryData(["battle", session?.user.id, id], result);
      void client.invalidateQueries({ queryKey: ["battles"] });
      if (type === "vote")
        analytics.track(
          "vote_submitted",
          { voting_mode: result.mode },
          `vote:${id}`,
        );
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please try again.");
      void query.refetch();
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function share(how: "sheet" | "copy" | "whatsapp" = "sheet") {
    if (!battle) return;
    last.current = "share";
    const text =
      battle.status === "waiting"
        ? "⚡ Fit battle! Join me with your look and let the squad decide 👀"
        : `⚡ FIT CHECK: ${battle.title}\nTwo looks. One winner. Pick your side and tell me why 👇`;
    try {
      if (how === "copy") await copyBattleLink(id);
      else if (how === "whatsapp") await whatsappBattleLink(id, text);
      else await shareBattleLink(id, battle.title, text);
      analytics.track("battle_shared", {
        method: how === "copy" ? "copy" : "share",
      });
      if (how === "copy") {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (e) {
      if (e instanceof Error && e.name !== "AbortError") setMessage(e.message);
    }
  }
  async function shareComment(commentName: string, body: string) {
    try {
      await shareBattleComment(id, commentName, body);
      setMessage("Comment shared.");
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError")
        setMessage(error.message);
    }
  }
  function signIn() {
    void rememberBattleReturn(id).then(() => router.push("/auth"));
  }

  function confirmDelete() {
    const remove = async () => {
      if (lock.current) return;
      lock.current = true;
      setBusy(true);
      setMessage("");
      try {
        await battleCall({ action: "delete", id });
        client.removeQueries({ queryKey: ["battle", session?.user.id, id] });
        await client.invalidateQueries({
          queryKey: ["battles", session?.user.id],
        });
        router.replace("/(tabs)/battles");
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Couldn’t delete this battle.",
        );
      } finally {
        lock.current = false;
        setBusy(false);
      }
    };
    const message =
      "This permanently deletes the battle, its votes and comments, and its shared photos.";
    if (Platform.OS === "web") {
      if (window.confirm(`Delete this battle?\n\n${message}`)) void remove();
    } else {
      Alert.alert("Delete this battle?", message, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void remove() },
      ]);
    }
  }

  const total = battle
    ? battle.options.reduce((n, o) => n + battle.counts[o.side], 0)
    : 0;
  const live = battle?.status === "published";
  const canVote =
    live && !battle?.mine && !battle?.isOwner && !battle?.isFriend;
  const showResults =
    !!battle &&
    (!!battle.mine ||
      battle.isOwner ||
      battle.isFriend ||
      battle.status === "closed");
  const challenger = battle?.players?.a;
  function renderComment(c: BattleView["comments"][number], nested = false) {
    return (
      <View
        key={c.id}
        style={{
          gap: 6,
          marginLeft: nested ? 40 : 0,
          paddingTop: nested ? 8 : 0,
        }}
      >
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Avatar name={c.name} size={28} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13 }}>
              {c.name}
              <Text
                style={{
                  fontFamily: fonts.body,
                  fontSize: 12,
                  color: "#8A8597",
                }}
              >
                {"  "}
                {ago(c.at)}
              </Text>
            </Text>
            <Body style={{ fontSize: 14, color: colors.ink }}>{c.body}</Body>
          </View>
          {(c.mine || battle?.isOwner) && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete comment"
              disabled={busy}
              onPress={() => void action("uncomment", { commentId: c.id })}
              style={{ padding: 6 }}
            >
              <Icon name="x" size={16} color={colors.text3} />
            </Pressable>
          )}
          {!c.mine && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Report or block ${c.name}`}
              onPress={() => setMenu(menu === c.id ? null : c.id)}
              style={{ paddingHorizontal: 6, paddingVertical: 2 }}
            >
              <Text
                style={{
                  fontFamily: fonts.bold,
                  fontSize: 18,
                  color: colors.text3,
                }}
              >
                ⋯
              </Text>
            </Pressable>
          )}
        </View>
        <View style={{ flexDirection: "row", gap: 16, marginLeft: 38 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={c.liked ? "Unlike comment" : "Like comment"}
            disabled={busy}
            onPress={() => void action("like-comment", { commentId: c.id })}
          >
            <Text
              style={{
                fontFamily: fonts.medium,
                fontSize: 13,
                color: c.liked ? colors.ink : colors.text3,
              }}
            >
              {c.liked ? "♥" : "♡"} Like{c.likes ? ` · ${c.likes}` : ""}
            </Text>
          </Pressable>
          {!nested && live && (
            <Pressable
              onPress={() => setReplyTo(c.id)}
              accessibilityRole="button"
            >
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 13,
                  color: colors.text3,
                }}
              >
                Reply
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => void shareComment(c.name, c.body)}
            accessibilityRole="button"
          >
            <Text
              style={{
                fontFamily: fonts.medium,
                fontSize: 13,
                color: colors.text3,
              }}
            >
              Share
            </Text>
          </Pressable>
        </View>
        {menu === c.id && (
          <View style={{ flexDirection: "row", gap: 8, marginLeft: 42 }}>
            {reported.includes(c.id) ? (
              <Body style={{ fontSize: 13 }}>
                Reported. Thanks, we’ll review it.
              </Body>
            ) : (
              <>
                <Pill
                  label="Report"
                  onPress={() =>
                    void action("report-comment", { commentId: c.id }).then(
                      (ok) => ok && setReported((r) => [...r, c.id]),
                    )
                  }
                />
                <Pill
                  label={`Block ${c.name}`}
                  onPress={() =>
                    void action("block", { commentId: c.id }).then(
                      (ok) =>
                        ok &&
                        setMessage(
                          `You won’t see comments from ${c.name} any more.`,
                        ),
                    )
                  }
                />
              </>
            )}
          </View>
        )}
      </View>
    );
  }

  const pair = battle?.options.length === 2;
  const voter = live && !battle?.isOwner && !battle?.isFriend;
  const blocked = !choice
    ? "Pick a fit first"
    : battle?.mode === "public" && name.trim().length < 2
      ? "Add your name"
      : battle?.mode === "public" && !consent
        ? "Turn on “Show my name”"
        : null;
  const [ca, cb] = battle
    ? battle.options.map((o) => battle.counts[o.side])
    : [];
  const winner =
    pair && ca !== cb ? battle!.options[ca! > cb! ? 0 : 1]!.side : null;
  const threads = battle?.comments.filter((c) => !c.parentId) ?? [];
  const band =
    !!battle && !["waiting"].includes(battle.status) && !query.isError;
  function sendComment() {
    last.current = "comment";
    if (name.trim().length < 2) {
      setMessage("Add your name to comment");
      nameField.current?.focus();
      return;
    }
    void action("comment", { name, body: comment, parentId: replyTo }).then(
      (ok) => {
        if (ok) {
          setComment("");
          setReplyTo(null);
        }
      },
    );
  }

  return (
    <Page>
      <View style={{ width: "100%", maxWidth: 480, alignSelf: "center" }}>
        {band ? (
          <VoteHeader
            battle={battle!}
            total={total}
            back={
              Platform.OS !== "web" || router.canGoBack()
                ? () =>
                    router.canGoBack()
                      ? router.back()
                      : router.replace("/(tabs)")
                : undefined
            }
          />
        ) : (
          <FlatHeader
            title={battle?.kind === "versus" ? "Fit battle" : "Help me choose"}
          />
        )}
        <View style={{ padding: 20, gap: 18 }}>
          {query.isPending ? (
            <LoadingSkeleton />
          ) : query.isError || !battle ? (
            <>
              <View style={[card, { alignItems: "center", gap: 12 }]}>
                <Icon name="hanger" size={34} />
                <Heading size={22} style={{ textAlign: "center" }}>
                  This battle isn’t available
                </Heading>
                <Button
                  secondary
                  title="Try again"
                  onPress={() => void query.refetch()}
                />
              </View>
              <GetTheApp />
            </>
          ) : battle.status === "waiting" ? (
            // Versus invite: the challenger waits; a friend joins with a look.
            <>
              <View style={{ alignItems: "center", gap: 10 }}>
                <Avatar
                  uri={challenger?.avatar}
                  name={challenger?.name ?? undefined}
                  size={72}
                />
                <Heading size={26} style={{ textAlign: "center" }}>
                  {battle.isOwner
                    ? "Waiting for your friend…"
                    : `${challenger?.name ?? "A friend"} challenged you!`}
                </Heading>
                <Body style={{ textAlign: "center" }}>{battle.title}</Body>
              </View>
              {battle.options[0]?.url && (
                <Image
                  source={{ uri: battle.options[0].url }}
                  contentFit="cover"
                  cachePolicy="none"
                  style={{
                    height: 300,
                    borderRadius: 26,
                    backgroundColor: colors.white,
                  }}
                />
              )}
              {battle.isOwner ? (
                <>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Button
                      style={{ flex: 1 }}
                      icon="share"
                      title="Send invite"
                      onPress={() => void share()}
                    />
                    <RoundAction
                      icon="whatsapp"
                      label="Invite on WhatsApp"
                      onPress={() => void share("whatsapp")}
                    />
                    <RoundAction
                      icon="copy"
                      label="Copy invite link"
                      onPress={() => void share("copy")}
                    />
                  </View>
                  <Body style={{ textAlign: "center", fontSize: 13 }}>
                    When your friend joins with their look, the battle goes live
                    and you can share it for votes.
                  </Body>
                </>
              ) : !session ? (
                <Button title="Sign in to accept" onPress={signIn} />
              ) : (
                <>
                  <Heading size={20}>Pick your look</Heading>
                  <LookPicker selected={pick} max={1} onChange={setPick} />
                  <Button
                    icon="zap"
                    title={busy ? "Joining…" : "Accept the battle"}
                    disabled={busy || pick.length !== 1}
                    onPress={() =>
                      void action("join", {
                        sourceKind: "job",
                        sourceId: pick[0],
                      })
                    }
                  />
                  <Body style={{ fontSize: 12, textAlign: "center" }}>
                    Anyone with the link will see your look, name and profile
                    photo.
                  </Body>
                </>
              )}
            </>
          ) : (
            <>
              {pair ? (
                <FitPicker
                  battle={battle}
                  choice={battle.mine ?? choice}
                  onSelect={canVote && !busy ? setChoice : undefined}
                  hint={
                    canVote
                      ? choice
                        ? "Changed your mind? Tap the other one."
                        : "Tap a fit to pick it"
                      : undefined
                  }
                />
              ) : (
                <BattleCards
                  battle={battle}
                  choice={battle.mine ?? choice}
                  onSelect={canVote && !busy ? setChoice : undefined}
                  results={showResults}
                />
              )}
              {voter && (
                <View style={card}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      height: 52,
                      borderRadius: 18,
                      backgroundColor: "#FFF8D9",
                      paddingHorizontal: 16,
                    }}
                  >
                    <Icon name="user" size={20} color={colors.text3} />
                    <TextInput
                      ref={nameField}
                      accessibilityLabel="Your name"
                      value={name}
                      onChangeText={setName}
                      maxLength={40}
                      placeholder="Your name"
                      placeholderTextColor={colors.placeholder}
                      style={{
                        flex: 1,
                        height: 52,
                        fontFamily: fonts.body,
                        fontSize: 16,
                        color: colors.ink,
                      }}
                    />
                  </View>
                  {battle.mode === "public" && !battle.mine && (
                    <Switch
                      value={consent}
                      label="Show my name with my vote"
                      onChange={setConsent}
                    />
                  )}
                  {battle.mine ? (
                    <View
                      accessibilityLiveRegion="polite"
                      style={{
                        height: 62,
                        borderRadius: 22,
                        backgroundColor: "#D7F6E3",
                        borderWidth: 2.5,
                        borderColor: "#127A55",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                      }}
                    >
                      <Icon name="check" size={22} color="#127A55" />
                      <Text
                        style={{
                          fontFamily: fonts.heading,
                          fontSize: 20,
                          color: "#0E5A3F",
                        }}
                      >
                        You voted {battle.mine}
                      </Text>
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ disabled: !!blocked || busy }}
                      disabled={!!blocked || busy}
                      onPress={() => {
                        last.current = "vote";
                        void action("vote", {
                          choice,
                          name,
                          publicConsent: consent,
                        });
                      }}
                      style={({ pressed }) => ({
                        height: 62,
                        borderRadius: 22,
                        borderWidth: blocked ? 0 : 2.5,
                        borderColor: colors.ink,
                        backgroundColor: blocked ? "#E6E1D2" : colors.yellow,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                        ...(blocked ? {} : hard(pressed ? 2 : 4)),
                        transform: [
                          { translateY: pressed && !blocked ? 2 : 0 },
                        ],
                      })}
                    >
                      {busy ? (
                        <ActivityIndicator color={colors.ink} />
                      ) : (
                        <>
                          {!blocked && <Icon name="zap" size={22} />}
                          <Text
                            style={{
                              fontFamily: fonts.heading,
                              fontSize: 20,
                              color: blocked ? "#8A8597" : colors.ink,
                            }}
                          >
                            {blocked ?? `Vote for ${choice}`}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  )}
                  {!!message && last.current === "vote" && (
                    <Text style={errorText}>{message}</Text>
                  )}
                </View>
              )}
              {["published", "closed"].includes(battle.status) && (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void share("whatsapp")}
                    style={({ pressed }) => ({
                      flex: 1,
                      height: 54,
                      borderRadius: 20,
                      backgroundColor: "#25D366",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      transform: [{ translateY: pressed ? 2 : 0 }],
                    })}
                  >
                    <Icon name="whatsapp" size={22} color={colors.white} />
                    <Text
                      style={{
                        fontFamily: fonts.bold,
                        fontSize: 16,
                        color: colors.white,
                      }}
                    >
                      Get more votes
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Copy link"
                    onPress={() => void share("copy")}
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 20,
                      borderWidth: 2,
                      borderColor: colors.ink,
                      backgroundColor: colors.white,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name={copied ? "check" : "link"} size={22} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Share"
                    onPress={() => void share()}
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 20,
                      backgroundColor: colors.ink,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="share" size={22} color={colors.yellow} />
                  </Pressable>
                </View>
              )}
              {copied && (
                <Text
                  accessibilityLiveRegion="polite"
                  style={{
                    alignSelf: "center",
                    marginTop: -6,
                    backgroundColor: colors.ink,
                    color: colors.white,
                    fontFamily: fonts.bold,
                    fontSize: 13,
                    borderRadius: 999,
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    overflow: "hidden",
                  }}
                >
                  Link copied
                </Text>
              )}
              <View style={{ gap: 12 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ fontFamily: fonts.heading, fontSize: 22 }}>
                    The score
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.medium,
                      fontSize: 13,
                      color: colors.text3,
                    }}
                  >
                    {total} {total === 1 ? "vote" : "votes"}
                  </Text>
                </View>
                {battle.status === "closed" && total > 0 && (
                  <Text
                    accessibilityLiveRegion="polite"
                    style={{ fontFamily: fonts.bold, fontSize: 16 }}
                  >
                    {winner ? `${winner} won` : "It’s a tie"}
                  </Text>
                )}
                {!showResults ? (
                  <Body style={{ fontSize: 14 }}>Vote to see the score.</Body>
                ) : pair ? (
                  <ScoreBar battle={battle} />
                ) : null}
                {battle.mode === "public" && battle.voters.length > 0 && (
                  <VoterChips voters={battle.voters} />
                )}
              </View>
              {["published", "closed"].includes(battle.status) && (
                <View
                  style={[card, { paddingTop: 18, paddingBottom: 14, gap: 14 }]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Text style={{ fontFamily: fonts.heading, fontSize: 22 }}>
                      Hot takes
                    </Text>
                    <View
                      style={{
                        backgroundColor: "#F1EEE4",
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 3,
                      }}
                    >
                      <Text style={{ fontFamily: fonts.bold, fontSize: 13 }}>
                        {battle.comments.length}
                      </Text>
                    </View>
                  </View>
                  {!battle.comments.length ? (
                    live ? (
                      <View
                        style={{
                          borderWidth: 2,
                          borderStyle: "dashed",
                          borderColor: "#E6E1D2",
                          borderRadius: 20,
                          padding: 18,
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: colors.yellow,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Icon name="send" size={18} />
                        </View>
                        <Text
                          style={{
                            fontFamily: fonts.body,
                            fontSize: 14,
                            color: colors.text2,
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: fonts.bold,
                              color: colors.ink,
                            }}
                          >
                            Quiet in here.
                          </Text>{" "}
                          Drop the first take.
                        </Text>
                      </View>
                    ) : null
                  ) : (
                    <>
                      {threads.slice(allComments ? 0 : -5).map((c) => (
                        <View key={c.id} style={{ gap: 6 }}>
                          {renderComment(c)}
                          {battle.comments
                            .filter((reply) => reply.parentId === c.id)
                            .map((reply) => renderComment(reply, true))}
                        </View>
                      ))}
                      {!allComments && threads.length > 5 && (
                        <TextLink
                          title={`Show all ${threads.length}`}
                          onPress={() => setAllComments(true)}
                        />
                      )}
                    </>
                  )}
                  {live ? (
                    <>
                      {replyTo !== null && (
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <Body style={{ fontSize: 13 }}>
                            Replying to{" "}
                            {
                              battle.comments.find((c) => c.id === replyTo)
                                ?.name
                            }
                          </Body>
                          <Pressable
                            onPress={() => setReplyTo(null)}
                            accessibilityRole="button"
                          >
                            <Text style={{ color: colors.text3 }}>Cancel</Text>
                          </Pressable>
                        </View>
                      )}
                      {pair && (
                        <View
                          style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 8,
                          }}
                        >
                          {[
                            ["A is the one", colors.pink],
                            ["B, easy", "#9FD0FF"],
                            ["Both go hard", colors.white],
                          ].map(([text, fill]) => (
                            <Pressable
                              key={text}
                              accessibilityRole="button"
                              accessibilityLabel={`Quick reply: ${text}`}
                              onPress={() => setComment(text!)}
                              style={{
                                height: 36,
                                justifyContent: "center",
                                paddingHorizontal: 14,
                                borderRadius: 999,
                                backgroundColor: fill,
                                borderWidth: 2,
                                borderColor:
                                  fill === colors.white ? "#E6E1D2" : fill,
                              }}
                            >
                              <Text
                                style={{ fontFamily: fonts.bold, fontSize: 13 }}
                              >
                                {text}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      )}
                      {!voter && !name.trim() && (
                        <TextInput
                          ref={nameField}
                          accessibilityLabel="Your name"
                          value={name}
                          onChangeText={setName}
                          maxLength={40}
                          placeholder="Your name"
                          placeholderTextColor={colors.placeholder}
                          style={[input, { flex: undefined }]}
                        />
                      )}
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        <TextInput
                          accessibilityLabel="Write a comment"
                          value={comment}
                          onChangeText={setComment}
                          maxLength={280}
                          placeholder={
                            replyTo === null
                              ? "Add a comment…"
                              : "Write a reply…"
                          }
                          placeholderTextColor={colors.placeholder}
                          style={input}
                        />
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Post comment"
                          disabled={busy || !comment.trim()}
                          onPress={sendComment}
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 26,
                            backgroundColor: colors.yellow,
                            borderWidth: 2.5,
                            borderColor: colors.ink,
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: comment.trim() ? 1 : 0.5,
                            ...hard(3),
                          }}
                        >
                          <Icon name="send" size={20} />
                        </Pressable>
                      </View>
                      {!!message && last.current === "comment" && (
                        <Text style={errorText}>{message}</Text>
                      )}
                      <Text
                        style={{
                          fontFamily: fonts.body,
                          fontSize: 12,
                          color: "#8A8597",
                        }}
                      >
                        Keep it kind ·{" "}
                        <Text
                          accessibilityRole="link"
                          onPress={() => router.push("/terms")}
                          style={{ textDecorationLine: "underline" }}
                        >
                          Terms
                        </Text>
                      </Text>
                    </>
                  ) : (
                    <Body style={{ fontSize: 14 }}>Comments are closed.</Body>
                  )}
                </View>
              )}
              {live && battle.isOwner && (
                <Body style={{ fontSize: 13, textAlign: "center" }}>
                  Posting to a story? Screenshot this, add it to your story and
                  put the copied link in a Link sticker.
                </Body>
              )}
              {!battle.isOwner && <GetTheApp battle={battle} />}
            </>
          )}
          {!!message && !["vote", "comment"].includes(last.current) && (
            <Body style={{ textAlign: "center" }}>{message}</Body>
          )}
          {battle && (battle.isOwner || battle.status !== "waiting") && (
            <View style={{ alignItems: "center" }}>
              {!more ? (
                <TextLink title="More options" onPress={() => setMore(true)} />
              ) : (
                <View style={{ alignSelf: "stretch", gap: 8 }}>
                  {battle.isOwner && live && (
                    <Button
                      secondary
                      title="Close voting"
                      disabled={busy}
                      onPress={() => void action("close")}
                    />
                  )}
                  {battle.isOwner && (
                    <Button
                      secondary
                      icon="trash-2"
                      title="Delete battle"
                      disabled={busy}
                      style={{ borderColor: "#D86A63" }}
                      onPress={confirmDelete}
                    />
                  )}
                  {battle.isOwner &&
                    ["draft", "waiting", "published", "closed"].includes(
                      battle.status,
                    ) &&
                    (stopping ? (
                      <>
                        <Body style={{ fontSize: 13, textAlign: "center" }}>
                          People with the link lose access. Saved screenshots
                          can’t be recalled. This can’t be undone.
                        </Body>
                        <Button
                          title="Stop sharing"
                          disabled={busy}
                          onPress={() => void action("unpublish")}
                        />
                      </>
                    ) : (
                      <Button
                        secondary
                        title="Stop sharing"
                        onPress={() => setStopping(true)}
                      />
                    ))}
                  {!battle.isOwner &&
                    (reporting ? (
                      [
                        "Inappropriate image",
                        "Harassment",
                        "Privacy concern",
                        "Other",
                      ].map((reason) => (
                        <Button
                          key={reason}
                          secondary
                          title={reason}
                          disabled={busy}
                          onPress={() =>
                            void battleCall({ action: "report", id, reason })
                              .then(() => {
                                setReporting(false);
                                setMessage("Thanks — we’ll review it.");
                              })
                              .catch((e) => setMessage(e.message))
                          }
                        />
                      ))
                    ) : (
                      <Button
                        secondary
                        title="Report this battle"
                        onPress={() => setReporting(true)}
                      />
                    ))}
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </Page>
  );
}
