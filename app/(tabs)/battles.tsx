import React from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  Body,
  Button,
  ErrorState,
  Heading,
  Icon,
  LoadingSkeleton,
  Page,
  SettingsButton,
} from "../../src/components/ui";
import { myBattles, type BattleRow } from "../../src/lib/battles";
import { useApp } from "../../src/lib/state";
import { colors, fonts, gradients, shadow } from "../../src/theme";

const STATUS: Record<BattleRow["status"], string> = {
  draft: "Draft",
  waiting: "Waiting for friend",
  published: "Live",
  closed: "Closed",
  unpublished: "Stopped",
  hidden: "Under review",
};

function ModeCard({
  emoji,
  title,
  text,
  tint,
  onPress,
}: {
  emoji: string;
  title: string;
  text: string;
  tint: readonly [string, string, ...string[]];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={{ flex: 1, borderRadius: 28, ...shadow(0.1) }}
    >
      <LinearGradient
        colors={tint}
        style={{
          flex: 1,
          borderRadius: 28,
          padding: 18,
          minHeight: 200,
          justifyContent: "space-between",
          borderWidth: 3,
          borderColor: colors.white,
        }}
      >
        <Text style={{ fontSize: 40 }}>{emoji}</Text>
        <View style={{ gap: 6 }}>
          <Heading size={21}>{title}</Heading>
          <Body style={{ fontSize: 13, color: colors.ink }}>{text}</Body>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export default function Battles() {
  const { session } = useApp();
  const query = useInfiniteQuery({
    queryKey: ["battles", session?.user.id],
    queryFn: ({ pageParam }) => myBattles(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) =>
      page.length === 20
        ? `${page[19]!.created_at}|${page[19]!.id}`
        : undefined,
    enabled: !!session,
    refetchInterval: 30000,
  });
  const items = query.data?.pages.flat() ?? [];
  const start = (kind: "choose" | "versus") =>
    router.push(
      session ? { pathname: "/battle-create", params: { kind } } : "/auth",
    );
  return (
    <Page>
      <View style={{ padding: 20, paddingTop: 24, gap: 20 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Heading size={32}>Battles</Heading>
            <Body>Let your friends decide.</Body>
          </View>
          <SettingsButton />
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <ModeCard
            emoji="🤔"
            title="Help me choose"
            text="Which outfit should I wear? Ask your friends."
            tint={gradients.lavender}
            onPress={() => start("choose")}
          />
          <ModeCard
            emoji="⚔️"
            title="Battle a friend"
            text="Your look vs theirs. Let the group vote."
            tint={gradients.coral}
            onPress={() => start("versus")}
          />
        </View>
        {session && (
          <>
            <Heading size={22}>Your battles</Heading>
            {query.isPending ? (
              <LoadingSkeleton />
            ) : query.isError ? (
              <ErrorState
                message="Your battles couldn’t load."
                retry={() => void query.refetch()}
              />
            ) : !items.length ? (
              <Body>Your battles will show up here.</Body>
            ) : (
              <View
                style={{
                  backgroundColor: colors.white,
                  borderRadius: 24,
                  overflow: "hidden",
                }}
              >
                {items.map((item, i) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: "/battle/[id]",
                        params: { id: item.id },
                      })
                    }
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 14,
                      padding: 16,
                      backgroundColor: pressed ? colors.chip : colors.white,
                      borderTopWidth: i ? 1 : 0,
                      borderTopColor: colors.cream,
                    })}
                  >
                    <Text style={{ fontSize: 24 }}>
                      {item.kind === "versus" ? "⚔️" : "🤔"}
                    </Text>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        numberOfLines={1}
                        style={{ fontFamily: fonts.bold, fontSize: 16 }}
                      >
                        {item.title}
                      </Text>
                      <Text
                        style={{
                          fontFamily: fonts.medium,
                          fontSize: 13,
                          color:
                            item.status === "published"
                              ? colors.ink
                              : colors.text3,
                        }}
                      >
                        {item.status === "published" ? "● " : ""}
                        {STATUS[item.status]}
                      </Text>
                    </View>
                    <Icon name="chevron-right" size={18} color={colors.text3} />
                  </Pressable>
                ))}
              </View>
            )}
            {query.hasNextPage && (
              <Button
                secondary
                disabled={query.isFetchingNextPage}
                title={query.isFetchingNextPage ? "Loading…" : "Load more"}
                onPress={() => void query.fetchNextPage()}
              />
            )}
          </>
        )}
      </View>
    </Page>
  );
}
