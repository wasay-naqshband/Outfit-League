import React from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  Body,
  Button,
  EmptyState,
  ErrorState,
  Heading,
  LoadingSkeleton,
  Page,
} from "../../src/components/ui";
import { myBattles } from "../../src/lib/battles";
import { useApp } from "../../src/lib/state";
import { gradients, colors } from "../../src/theme";
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
  return (
    <Page>
      <LinearGradient
        colors={gradients.yellow}
        style={{
          paddingHorizontal: 20,
          paddingTop: 28,
          paddingBottom: 30,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
          gap: 12,
        }}
      >
        <Heading size={32}>Which fit wins?</Heading>
        <Body>Two looks. Your friends. Their pick.</Body>
        <Button
          title="Create a battle"
          icon="plus"
          onPress={() => router.push(session ? "/battle-create" : "/auth")}
        />
      </LinearGradient>
      <View style={{ padding: 20, gap: 16 }}>
        <Heading size={26}>Your battles</Heading>
        {!session ? (
          <EmptyState
            title="Bring in the squad."
            message="Sign in to create battles. Anyone can open a shared battle link; anonymous battles allow browser votes without signing in."
            action="Sign in"
            onPress={() => router.push("/auth")}
          />
        ) : query.isPending ? (
          <LoadingSkeleton />
        ) : query.isError ? (
          <ErrorState
            message="Your battles couldn’t load."
            retry={() => void query.refetch()}
          />
        ) : (
          <>
            {!items.length && (
              <EmptyState
                title="Let the looks compete."
                message="Choose two Closet images or completed AI previews. Pick anonymous or public voting, then preview before publishing."
                action="Create your first battle"
                onPress={() => router.push("/battle-create")}
              />
            )}
            {items.map((item) => (
              <View
                key={item.id}
                style={{
                  backgroundColor: colors.white,
                  padding: 20,
                  borderRadius: 28,
                  gap: 10,
                }}
              >
                <Heading size={23}>{item.title}</Heading>
                <Body>
                  {item.status} · {item.voting_mode} votes
                </Body>
                <Button
                  secondary
                  title={`Open ${item.title}`}
                  onPress={() =>
                    router.push({
                      pathname: "/battle/[id]",
                      params: { id: item.id },
                    })
                  }
                />
              </View>
            ))}
            {query.hasNextPage && (
              <Button
                secondary
                disabled={query.isFetchingNextPage}
                title={
                  query.isFetchingNextPage ? "Loading…" : "Load more battles"
                }
                onPress={() => void query.fetchNextPage()}
              />
            )}
          </>
        )}
        <Body style={{ fontSize: 13 }}>
          Share links with friends, group chats or story viewers. Your Closet
          stays private until you explicitly publish the two selected images.
          Public discovery is not enabled yet.
        </Body>
      </View>
    </Page>
  );
}
