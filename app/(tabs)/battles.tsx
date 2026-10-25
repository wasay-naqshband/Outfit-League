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
import { StickerTag } from "../../src/components/Redesign";
import { BattleModeCards } from "../../src/components/BattleModeCards";
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
  const liveCount = items.filter((item) => item.status === "published").length;
  const start = (kind: "choose" | "versus") =>
    router.push(
      session ? { pathname: "/battle-create", params: { kind } } : "/auth",
    );

  return (
    <Page>
      <LinearGradient
        colors={gradients.yellow}
        style={{
          paddingHorizontal: 20,
          paddingTop: 28,
          paddingBottom: 24,
          gap: 14,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
          ...shadow(0.1),
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Heading size={32}>Battles</Heading>
          <SettingsButton />
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <Heading size={29}>Let your friends</Heading>
          <StickerTag size={23}>decide.</StickerTag>
        </View>
      </LinearGradient>

      <View style={{ padding: 20, paddingBottom: 140, gap: 18 }}>
        <BattleModeCards
          onChoose={() => start("choose")}
          onVersus={() => start("versus")}
        />

        {session && (
          <>
            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginTop: 2,
              }}
            >
              <Heading size={22}>Your battles</Heading>
              <Text
                style={{
                  color: colors.text2,
                  fontFamily: fonts.bold,
                  fontSize: 13,
                }}
              >
                {liveCount} live
              </Text>
            </View>
            {query.isPending ? (
              <LoadingSkeleton />
            ) : query.isError ? (
              <ErrorState
                message="Your battles couldn’t load."
                retry={() => void query.refetch()}
              />
            ) : !items.length ? (
              <View
                style={{
                  borderRadius: 24,
                  backgroundColor: colors.white,
                  padding: 18,
                  ...shadow(0.06),
                }}
              >
                <Body>Your battles will show up here.</Body>
              </View>
            ) : (
              <View
                style={{
                  backgroundColor: colors.white,
                  borderRadius: 24,
                  overflow: "hidden",
                  ...shadow(0.05),
                }}
              >
                {items.map((item, i) => (
                  <BattleRowView
                    key={item.id}
                    item={item}
                    last={i === items.length - 1}
                    onPress={() =>
                      router.push({
                        pathname: "/battle/[id]",
                        params: { id: item.id },
                      })
                    }
                  />
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

function BattleRowView({
  item,
  last,
  onPress,
}: {
  item: BattleRow;
  last: boolean;
  onPress: () => void;
}) {
  const tone =
    item.status === "published"
      ? { dot: "#1FAF66", text: "#0E6B45" }
      : item.status === "waiting"
        ? { dot: "#E0A100", text: "#8A5A00" }
        : {
            dot: null,
            text: item.status === "draft" ? "#6B6675" : colors.text3,
          };
  const tile =
    item.status === "draft"
      ? "#F1EEE4"
      : item.kind === "versus"
        ? "#FFD2C8"
        : "#E6E1FF";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${STATUS[item.status]}`}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 64,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: pressed ? colors.cream : colors.white,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: "#F0ECE0",
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: tile,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontFamily: fonts.heading,
            fontSize: item.kind === "versus" ? 13 : 12,
            color: colors.ink,
          }}
        >
          {item.kind === "versus" ? "VS" : "A/B"}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink }}
        >
          {item.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          {tone.dot && (
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: tone.dot,
              }}
            />
          )}
          <Text
            style={{ fontFamily: fonts.bold, fontSize: 11, color: tone.text }}
          >
            {STATUS[item.status]}
          </Text>
        </View>
      </View>
      <Icon name="chevron-right" size={18} color={colors.text3} />
    </Pressable>
  );
}
