import React from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  Body,
  Button,
  EmptyState,
  ErrorState,
  FlatHeader,
  Heading,
  Icon,
  LoadingSkeleton,
  Page,
} from "../src/components/ui";
import { PieceOptions } from "../src/components/ShopTheLook";
import { libraryPage, shopQuery } from "../src/lib/library";
import { useApp } from "../src/lib/state";
import { art } from "../src/data";
import { colors, shadow } from "../src/theme";

// Shop → Your saved looks: each saved piece with the store options to buy it.
export default function ShopSaved() {
  const { session } = useApp();
  const library = useInfiniteQuery({
    queryKey: ["shop-saved", session?.user.id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => libraryPage(pageParam),
    getNextPageParam: (page) =>
      page.length === 40
        ? `${page[39]!.created_at}|${page[39]!.id}`
        : undefined,
    enabled: !!session,
    refetchInterval: 240000,
  });
  const items = library.data?.pages.flat() ?? [];
  return (
    <Page>
      <FlatHeader title="Your saved looks" />
      <View style={{ padding: 20, gap: 16 }}>
        {!session ? (
          <Button
            title="Sign in to shop your saved looks"
            onPress={() => router.push("/auth")}
          />
        ) : library.isPending ? (
          <LoadingSkeleton />
        ) : library.isError ? (
          <ErrorState
            message="Saved items couldn’t load."
            retry={() => void library.refetch()}
          />
        ) : !items.length ? (
          <EmptyState
            title="Nothing saved yet."
            message="Add clothes in Closet or save an outfit from Explore."
            action="Open Closet"
            onPress={() => router.push("/(tabs)/closet")}
          />
        ) : (
          <>
            {items.map((item) => (
              <View
                key={item.id}
                style={{
                  borderRadius: 24,
                  backgroundColor: colors.white,
                  padding: 14,
                  gap: 12,
                  ...shadow(0.05),
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      width: 52,
                      height: 60,
                      borderRadius: 14,
                      overflow: "hidden",
                      backgroundColor: colors.chip,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {item.photoUrl || item.explore_image ? (
                      <Image
                        source={
                          item.photoUrl
                            ? { uri: item.photoUrl }
                            : art[item.explore_image!]
                        }
                        contentFit="cover"
                        cachePolicy="none"
                        style={{ width: "100%", height: "100%" }}
                      />
                    ) : (
                      <Icon name="hanger" size={24} color={colors.text3} />
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Heading size={18}>{item.name}</Heading>
                    {!!item.category && (
                      <Body style={{ fontSize: 13 }}>{item.category}</Body>
                    )}
                  </View>
                </View>
                <PieceOptions
                  bare
                  item={item.photo_path ? item.id : undefined}
                  piece={{
                    part: "accessory",
                    name: item.name,
                    query: shopQuery(item),
                    closetId: null,
                  }}
                />
              </View>
            ))}
            {library.hasNextPage && (
              <Button
                secondary
                disabled={library.isFetchingNextPage}
                title="Load more"
                onPress={() => void library.fetchNextPage()}
              />
            )}
          </>
        )}
      </View>
    </Page>
  );
}
