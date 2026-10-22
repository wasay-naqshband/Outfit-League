import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
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
  battleCall,
  copyBattleLink,
  shareBattleLink,
  whatsappBattleLink,
  rememberBattleReturn,
  type BattleView,
  type Side,
} from "../../src/lib/battles";
import { useApp } from "../../src/lib/state";
import { useProfile } from "../../src/lib/queries";
import { analytics } from "../../src/lib/analytics";
import { colors, fonts } from "../../src/theme";

function Chip({ text }: { text: string }) {
  return (
    <View
      style={{
        backgroundColor: colors.white,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
      }}
    >
      <Text style={{ fontFamily: fonts.medium, fontSize: 13 }}>{text}</Text>
    </View>
  );
}

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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [more, setMore] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const lock = useRef(false);
  const battle = query.data;
  useEffect(() => {
    if (profile.data?.name) setName(profile.data.name);
  }, [profile.data?.name]);

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
    const text =
      battle.status === "waiting"
        ? "I challenge you to a fit battle on Outfit League 👀 Join with your look:"
        : `${battle.title} Vote for your pick 👇`;
    try {
      if (how === "copy") await copyBattleLink(id);
      else if (how === "whatsapp") await whatsappBattleLink(id, text);
      else await shareBattleLink(id, battle.title, text);
      analytics.track("battle_shared", {
        method: how === "copy" ? "copy" : "share",
      });
      if (how === "copy") setMessage("Link copied ✓ Paste it anywhere.");
    } catch (e) {
      if (e instanceof Error && e.name !== "AbortError") setMessage(e.message);
    }
  }
  function signIn() {
    void rememberBattleReturn(id).then(() => router.push("/auth"));
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

  return (
    <Page>
      <FlatHeader
        title={battle?.kind === "versus" ? "Fit battle" : "Help me choose"}
      />
      <View style={{ padding: 20, gap: 16 }}>
        {query.isPending ? (
          <LoadingSkeleton />
        ) : query.isError || !battle ? (
          <ErrorState
            message="This battle is unavailable or no longer shared."
            retry={() => void query.refetch()}
          />
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
            <Heading size={28}>{battle.title}</Heading>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Chip
                text={
                  battle.mode === "public" ? "👥 Public votes" : "🙈 Anonymous"
                }
              />
              <Chip text={`${total} ${total === 1 ? "vote" : "votes"}`} />
              {battle.status === "closed" && <Chip text="Voting closed" />}
              {battle.status === "draft" && <Chip text="Draft" />}
              {["unpublished", "hidden"].includes(battle.status) && (
                <Chip text="No longer shared" />
              )}
            </View>
            <BattleCards
              battle={battle}
              choice={battle.mine ?? choice}
              onSelect={canVote && !busy ? setChoice : undefined}
              results={showResults}
            />
            {battle.mine && (
              <Body style={{ textAlign: "center" }}>
                You picked {battle.mine} ✓
              </Body>
            )}
            {canVote &&
              (battle.mode === "public" && !session ? (
                <Button title="Sign in to vote" onPress={signIn} />
              ) : (
                <>
                  {battle.mode === "public" && (
                    <>
                      <TextInput
                        accessibilityLabel="Your name"
                        value={name}
                        onChangeText={setName}
                        maxLength={40}
                        placeholder="Your name"
                        placeholderTextColor={colors.placeholder}
                        style={{
                          backgroundColor: colors.white,
                          borderRadius: 18,
                          padding: 16,
                          fontFamily: fonts.body,
                          fontSize: 16,
                          color: colors.ink,
                        }}
                      />
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: consent }}
                        onPress={() => setConsent(!consent)}
                        style={{
                          flexDirection: "row",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 6,
                            borderWidth: 2,
                            borderColor: colors.ink,
                            backgroundColor: consent
                              ? colors.ink
                              : colors.white,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {consent && (
                            <Icon
                              name="check"
                              size={14}
                              color={colors.yellow}
                            />
                          )}
                        </View>
                        <Body style={{ flex: 1, fontSize: 13 }}>
                          Show my name with my vote
                        </Body>
                      </Pressable>
                    </>
                  )}
                  <Button
                    title={
                      busy
                        ? "Voting…"
                        : choice
                          ? `Vote for ${choice}`
                          : "Tap a look to vote"
                    }
                    disabled={
                      busy ||
                      !choice ||
                      (battle.mode === "public" &&
                        (!consent || name.trim().length < 2))
                    }
                    onPress={() =>
                      void action("vote", {
                        choice,
                        name,
                        publicConsent: consent,
                      })
                    }
                  />
                </>
              ))}
            {["published", "closed"].includes(battle.status) && (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button
                  style={{ flex: 1 }}
                  icon="share"
                  title={battle.isOwner ? "Share for votes" : "Share"}
                  onPress={() => void share()}
                />
                <RoundAction
                  icon="whatsapp"
                  label="Share on WhatsApp"
                  onPress={() => void share("whatsapp")}
                />
                <RoundAction
                  icon="copy"
                  label="Copy link"
                  onPress={() => void share("copy")}
                />
              </View>
            )}
            {battle.mode === "public" && battle.voters.length > 0 && (
              <View
                style={{
                  backgroundColor: colors.white,
                  borderRadius: 22,
                  padding: 16,
                  gap: 10,
                }}
              >
                <Heading size={18}>Who picked what</Heading>
                {battle.voters.map((voter) => (
                  <View
                    key={voter.id}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Body style={{ flex: 1 }}>{voter.display_name}</Body>
                    <Heading size={16}>{voter.choice}</Heading>
                  </View>
                ))}
              </View>
            )}
            {["published", "closed"].includes(battle.status) && (
              <View
                style={{
                  backgroundColor: colors.white,
                  borderRadius: 22,
                  padding: 16,
                  gap: 12,
                }}
              >
                <Heading size={18}>
                  Comments
                  {battle.comments.length ? ` · ${battle.comments.length}` : ""}
                </Heading>
                {!battle.comments.length && (
                  <Body style={{ fontSize: 14 }}>
                    {live
                      ? "No comments yet. Say what you think!"
                      : "No comments."}
                  </Body>
                )}
                {battle.comments.map((c) => (
                  <View key={c.id} style={{ flexDirection: "row", gap: 10 }}>
                    <Avatar name={c.name} size={32} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 14 }}>
                        {c.name}
                      </Text>
                      <Body style={{ fontSize: 15, color: colors.ink }}>
                        {c.body}
                      </Body>
                    </View>
                    {(c.mine || battle.isOwner) && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Delete comment"
                        disabled={busy}
                        onPress={() =>
                          void action("uncomment", { commentId: c.id })
                        }
                        style={{ padding: 6 }}
                      >
                        <Icon name="x" size={16} color={colors.text3} />
                      </Pressable>
                    )}
                  </View>
                ))}
                {live && (
                  <>
                    {!profile.data?.name && (
                      <TextInput
                        accessibilityLabel="Your name"
                        value={name}
                        onChangeText={setName}
                        maxLength={40}
                        placeholder="Your name"
                        placeholderTextColor={colors.placeholder}
                        style={{
                          backgroundColor: colors.cream,
                          borderRadius: 16,
                          padding: 12,
                          fontFamily: fonts.body,
                          fontSize: 15,
                          color: colors.ink,
                        }}
                      />
                    )}
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <TextInput
                        accessibilityLabel="Write a comment"
                        value={comment}
                        onChangeText={setComment}
                        maxLength={280}
                        placeholder="Add a comment…"
                        placeholderTextColor={colors.placeholder}
                        style={{
                          flex: 1,
                          backgroundColor: colors.cream,
                          borderRadius: 16,
                          padding: 12,
                          fontFamily: fonts.body,
                          fontSize: 15,
                          color: colors.ink,
                        }}
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Post comment"
                        disabled={
                          busy || !comment.trim() || name.trim().length < 2
                        }
                        onPress={() =>
                          void action("comment", { name, body: comment }).then(
                            (ok) => ok && setComment(""),
                          )
                        }
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: 23,
                          backgroundColor:
                            comment.trim() && name.trim().length >= 2
                              ? colors.ink
                              : colors.inactive,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon name="send" size={18} color={colors.yellow} />
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            )}
            {live && battle.isOwner && (
              <Body style={{ fontSize: 13, textAlign: "center" }}>
                Posting to a story? Screenshot this, add it to your story and
                put the copied link in a Link sticker.
              </Body>
            )}
          </>
        )}
        {!!message && <Body style={{ textAlign: "center" }}>{message}</Body>}
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
    </Page>
  );
}
