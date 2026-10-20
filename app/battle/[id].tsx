import React, { useEffect, useRef, useState } from "react";
import { View, TextInput, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Body,
  Button,
  ErrorState,
  FlatHeader,
  Heading,
  LoadingSkeleton,
  Page,
} from "../../src/components/ui";
import { BattleCards } from "../../src/components/BattleCards";
import {
  battleCall,
  copyBattleLink,
  publicBattleUrl,
  shareBattleLink,
  type BattleView,
  rememberBattleReturn,
} from "../../src/lib/battles";
import { useApp } from "../../src/lib/state";
import { analytics } from "../../src/lib/analytics";
import { colors, fonts } from "../../src/theme";
import { supabase } from "../../src/lib/supabase";
export default function BattleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { session, ready } = useApp(),
    client = useQueryClient();
  const query = useQuery({
    queryKey: ["battle", session?.user.id, id],
    queryFn: () => battleCall({ action: "view", id }),
    enabled: ready && !!id,
    refetchInterval: 45000,
  });
  const [choice, setChoice] = useState<"A" | "B" | null>(null),
    [name, setName] = useState(""),
    [consent, setConsent] = useState(false),
    [publishConsent, setPublishConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [story, setStory] = useState(false),
    [confirmUnpublish, setConfirmUnpublish] = useState(false),
    [reporting, setReporting] = useState(false),
    [extra, setExtra] = useState<BattleView["voters"]>([]),
    [more, setMore] = useState(true);
  const lock = useRef(false),
    battle = query.data;
  useEffect(() => {
    let live = true;
    setName("");
    setConsent(false);
    if (session)
      void supabase
        ?.from("profiles")
        .select("display_name")
        .eq("id", session.user.id)
        .single()
        .then(({ data }) => {
          if (live) setName(data?.display_name ?? "");
        });
    return () => {
      live = false;
    };
  }, [session?.user.id]);
  async function action(type: string, fields: Record<string, unknown> = {}) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await battleCall({ action: type, id, ...fields });
      client.setQueryData(["battle", session?.user.id, id], result);
      await client.invalidateQueries({ queryKey: ["battles"] });
      if (type === "vote") {
        analytics.track(
          "vote_submitted",
          { voting_mode: result.mode },
          `vote:${id}`,
        );
        setMessage(`Your vote for Fit ${result.mine} is recorded.`);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please try again.");
      void query.refetch();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function share(copy = false) {
    try {
      await (copy ? copyBattleLink(id) : shareBattleLink(id, battle!.title));
      analytics.track("battle_shared", { method: copy ? "copy" : "share" });
      setMessage(
        copy
          ? "Voting link copied."
          : "Share sheet opened, or link copied if sharing is unavailable.",
      );
    } catch (e) {
      if (e instanceof Error && e.name !== "AbortError") setMessage(e.message);
    }
  }
  async function report(reason: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await battleCall({ action: "report", id, reason });
      setMessage("Report received for review.");
      setReporting(false);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please try again.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function loadVoters() {
    if (busy || !battle) return;
    setBusy(true);
    try {
      const last = [...battle.voters, ...extra].at(-1)?.id ?? 0;
      const page = await battleCall({ action: "view", id, after: last });
      setExtra((prior) => [...prior, ...page.voters]);
      setMore(page.voters.length === 40);
    } catch {
      setMessage("More votes couldn’t load. Try again.");
    } finally {
      setBusy(false);
    }
  }
  const voters = [
    ...new Map(
      [...(battle?.voters ?? []), ...extra].map((v) => [v.id, v]),
    ).values(),
  ];
  const canVote = battle?.status === "published" && !battle.mine;
  return (
    <Page>
      <FlatHeader
        title="Which fit wins?"
        pill={battle?.status === "draft" ? "Private preview" : "Outfit League"}
      />
      <View style={{ padding: 20, gap: 16 }}>
        {query.isPending ? (
          <LoadingSkeleton />
        ) : query.isError ? (
          <ErrorState
            message="This battle is unavailable, unpublished or hidden."
            retry={() => void query.refetch()}
          />
        ) : (
          battle && (
            <>
              <Heading size={30}>{battle.title}</Heading>
              <Body>
                {battle.mode === "anonymous"
                  ? "Anonymous voting · names are not displayed"
                  : "Public voting · display names and choices are visible to anyone with this link"}
              </Body>
              <BattleCards
                battle={battle}
                choice={battle.mine ?? choice}
                onSelect={canVote && !busy ? setChoice : undefined}
              />
              <Heading size={23}>
                {battle.counts.A + battle.counts.B}{" "}
                {battle.counts.A + battle.counts.B === 1 ? "vote" : "votes"}
                {battle.counts.A + battle.counts.B
                  ? battle.counts.A === battle.counts.B
                    ? " · It’s a tie!"
                    : ` · Fit ${battle.counts.A > battle.counts.B ? "A" : "B"} leads`
                  : ""}
              </Heading>
              <Body>
                {battle.status === "published"
                  ? "Send the link to friends or share it with story viewers. Anyone with the link can open this battle."
                  : battle.status === "closed"
                    ? "Voting is closed. Results remain visible to people with the link."
                    : battle.status === "draft"
                      ? "This preview is private. Publishing shares only these two battle images."
                      : battle.status === "hidden"
                        ? "This battle is hidden for moderation review."
                        : "This battle is no longer shared."}
              </Body>
              {battle.mine && (
                <Body>
                  Your recorded pick: Fit {battle.mine}. Votes are final;
                  repeated taps do not add votes.
                </Body>
              )}
              {canVote && (
                <>
                  {battle.mode === "public" &&
                    (!session ? (
                      <Button
                        title="Sign in to cast a public vote"
                        onPress={() => {
                          void rememberBattleReturn(id).then(() =>
                            router.push("/auth"),
                          );
                        }}
                      />
                    ) : (
                      <>
                        <Body>Your public display name</Body>
                        <TextInput
                          accessibilityLabel="Public voter display name"
                          value={name}
                          onChangeText={setName}
                          maxLength={40}
                          editable={!busy}
                          placeholder="Choose a display name"
                          style={{
                            backgroundColor: colors.white,
                            borderRadius: 18,
                            padding: 16,
                            fontFamily: fonts.body,
                            fontSize: 17,
                          }}
                        />
                        <Pressable
                          accessibilityRole="checkbox"
                          accessibilityLabel="Show my display name and vote publicly"
                          accessibilityState={{ checked: consent }}
                          onPress={() => setConsent(!consent)}
                          style={{
                            padding: 16,
                            borderRadius: 18,
                            backgroundColor: colors.chip,
                          }}
                        >
                          <Body>
                            {consent ? "☑" : "☐"} I agree that anyone with this
                            link can see my display name and which fit I vote
                            for. Display names are self-chosen.
                          </Body>
                        </Pressable>
                      </>
                    ))}
                  <Button
                    title={
                      busy
                        ? "Recording…"
                        : choice
                          ? `Vote ${choice}${battle.mode === "public" ? " publicly" : ""}`
                          : "Choose Fit A or B above"
                    }
                    disabled={
                      busy ||
                      !choice ||
                      (battle.mode === "public" &&
                        (!session || !consent || name.trim().length < 2))
                    }
                    onPress={() =>
                      void action("vote", {
                        choice,
                        name,
                        publicConsent: consent,
                      })
                    }
                  />
                  {battle.mode === "anonymous" && (
                    <Body style={{ fontSize: 13 }}>
                      A browser identifier or account is used to reduce
                      duplicate votes. No voter names are shown. Clearing
                      browser data or using another device can bypass basic
                      limits.
                    </Body>
                  )}
                </>
              )}
              {battle.mode === "public" &&
                ["published", "closed"].includes(battle.status) && (
                  <>
                    <Heading size={23}>Who voted for what</Heading>
                    {!voters.length ? (
                      <Body>No public votes yet.</Body>
                    ) : (
                      voters.map((voter) => (
                        <View
                          key={voter.id}
                          style={{
                            padding: 14,
                            borderRadius: 18,
                            backgroundColor: colors.white,
                            flexDirection: "row",
                            justifyContent: "space-between",
                            gap: 10,
                          }}
                        >
                          <Body style={{ flex: 1 }}>{voter.display_name}</Body>
                          <Heading size={18}>Fit {voter.choice}</Heading>
                        </View>
                      ))
                    )}
                    {battle.voters.length === 40 && more && (
                      <Button
                        secondary
                        title="Load more public votes"
                        disabled={busy}
                        onPress={() => void loadVoters()}
                      />
                    )}
                  </>
                )}
              {battle.isOwner && battle.status === "draft" && (
                <>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel="Allow these two images to be shared publicly"
                    accessibilityState={{ checked: publishConsent }}
                    onPress={() => setPublishConsent(!publishConsent)}
                    style={{
                      padding: 18,
                      borderRadius: 20,
                      backgroundColor: colors.chip,
                    }}
                  >
                    <Body>
                      {publishConsent ? "☑" : "☐"} I have permission to share
                      both images publicly. Anyone with the link can view, copy
                      or screenshot them. My other Closet images stay private.
                      Voting mode stays {battle.mode}.
                    </Body>
                  </Pressable>
                  {!battle.ready && (
                    <Body>
                      The images are not ready. Go back and retry the private
                      preview with the same selections.
                    </Body>
                  )}
                  <Button
                    title={busy ? "Publishing…" : "Publish battle"}
                    disabled={busy || !publishConsent || !battle.ready}
                    onPress={() =>
                      void action("publish", { consent: publishConsent })
                    }
                  />
                </>
              )}
              {["published", "closed"].includes(battle.status) && (
                <>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Button
                      style={{ flex: 1 }}
                      title="Share battle"
                      icon="share"
                      disabled={busy}
                      onPress={() => void share()}
                    />
                    <Button
                      secondary
                      title="Copy link"
                      disabled={busy}
                      onPress={() => void share(true)}
                    />
                  </View>
                  {!publicBattleUrl(id) && (
                    <Body style={{ fontSize: 13 }}>
                      The public hosting address is being connected. Local
                      previews work on this computer; friend and story links
                      will activate when hosting is ready.
                    </Body>
                  )}
                  {publicBattleUrl(id) && (
                    <TextInput
                      accessibilityLabel="Battle voting link"
                      value={publicBattleUrl(id)!}
                      editable={false}
                      selectTextOnFocus
                      style={{
                        backgroundColor: colors.white,
                        padding: 14,
                        borderRadius: 16,
                        fontFamily: fonts.body,
                        fontSize: 14,
                        color: colors.ink,
                      }}
                    />
                  )}
                  <Button
                    secondary
                    title="Share in a story"
                    onPress={() => setStory(!story)}
                  />
                  {story && (
                    <View
                      style={{
                        padding: 18,
                        borderRadius: 22,
                        backgroundColor: colors.chip,
                        gap: 12,
                      }}
                    >
                      <Heading size={23}>Let your story decide.</Heading>
                      <Body>
                        Take a screenshot of the battle cards, add it to your
                        story, and paste the voting URL into a Link sticker.
                        Viewers tap it to vote in their browser. This app does
                        not post to your social accounts automatically.
                      </Body>
                      <Button
                        title="Copy story voting link"
                        onPress={() => void share(true)}
                      />
                    </View>
                  )}
                  <Button
                    secondary
                    title="Report this battle"
                    onPress={() => setReporting(!reporting)}
                  />
                  {reporting && (
                    <View style={{ gap: 8 }}>
                      {[
                        "Inappropriate image",
                        "Harassment",
                        "Privacy concern",
                        "Other",
                      ].map((reason) => (
                        <Button
                          key={reason}
                          secondary
                          disabled={busy}
                          title={`Report: ${reason}`}
                          onPress={() => void report(reason)}
                        />
                      ))}
                    </View>
                  )}
                </>
              )}
              {battle.isOwner && (
                <>
                  {battle.status === "published" && (
                    <Button
                      secondary
                      disabled={busy}
                      title="Close voting"
                      onPress={() => void action("close")}
                    />
                  )}
                  {["draft", "published", "closed"].includes(battle.status) && (
                    <>
                      {confirmUnpublish ? (
                        <>
                          <Body>
                            Stop sharing this battle? New visitors will lose
                            access. Already downloaded images cannot be
                            recalled; existing image links expire within one
                            minute. This battle cannot be republished.
                          </Body>
                          <Button
                            title="Confirm unpublish"
                            disabled={busy}
                            onPress={() => void action("unpublish")}
                          />
                          <Button
                            secondary
                            title="Keep battle"
                            onPress={() => setConfirmUnpublish(false)}
                          />
                        </>
                      ) : (
                        <Button
                          secondary
                          disabled={busy}
                          title="Unpublish battle"
                          onPress={() => setConfirmUnpublish(true)}
                        />
                      )}
                    </>
                  )}
                  <Button
                    secondary
                    title="My battles"
                    onPress={() => router.push("/(tabs)/battles")}
                  />
                </>
              )}
              {!!message && <Body>{message}</Body>}
              <Button
                secondary
                title="Refresh results"
                disabled={busy || query.isFetching}
                onPress={() => void query.refetch()}
              />
              <Body style={{ fontSize: 13 }}>
                Sample illustrations and AI previews are labeled on each fit.
                Voting and sharing use no AI credits.
              </Body>
            </>
          )
        )}
      </View>
    </Page>
  );
}
