import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
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
import { lookDate } from "../src/components/AiLooks";
import { libraryPage, type LibraryItem } from "../src/lib/library";
import { useApp } from "../src/lib/state";
import { useHistory } from "../src/lib/queries";
import { art } from "../src/data";
import { colors, fonts, shadow } from "../src/theme";

// The store search for a saved piece: its name, plus its colour when the
// name doesn't already say it.
const shopQuery = (item: LibraryItem) =>
  item.color && !item.name.toLowerCase().includes(item.color.toLowerCase())
    ? `${item.color} ${item.name}`
    : item.name;

// Shop → Your saved looks: tap a saved piece to see it in real US stores, or
// open an AI look to shop it from its result.
export default function ShopSaved() {
  const { session } = useApp(),
    history = useHistory();
  const [open, setOpen] = useState<string | null>(null);
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
  const looks = (history.data ?? []).filter(
    (job) => job.status === "completed",
  );
  return (
    <Page>
      <FlatHeader title="Shop saved looks" />
      <View style={{ padding: 20, gap: 16 }}>
        <Body>Tap a piece to find it in US stores.</Body>
        {!session ? (
          <Button
            title="Sign in to shop your saved looks"
            onPress={() => router.push("/auth")}
          />
        ) : (
          <>
            <Heading size={24}>Your saved items</Heading>
            {library.isPending ? (
              <LoadingSkeleton />
            ) : library.isError ? (
              <ErrorState
                message="Saved items couldn’t load."
                retry={() => void library.refetch()}
              />
            ) : (
              <>
                {!items.length && (
                  <EmptyState
                    title="Save a little inspiration."
                    message="Add a link or photo in Closet, or save an outfit from Explore."
                    action="Open Closet"
                    onPress={() => router.push("/(tabs)/closet")}
                  />
                )}
                {items.map((item) => {
                  const expanded = open === item.id;
                  return (
                    <View
                      key={item.id}
                      style={{
                        borderRadius: 24,
                        backgroundColor: colors.white,
                        padding: 14,
                        gap: 14,
                        ...shadow(0.05),
                      }}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ expanded }}
                        accessibilityLabel={`Shop ${item.name}`}
                        onPress={() => setOpen(expanded ? null : item.id)}
                        style={{
                          flexDirection: "row",
                          gap: 14,
                          alignItems: "center",
                        }}
                      >
                        <View
                          style={{
                            width: 65,
                            height: 75,
                            borderRadius: 16,
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
                            <Icon
                              name="hanger"
                              size={26}
                              color={colors.text3}
                            />
                          )}
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Heading size={18}>{item.name}</Heading>
                          <Body style={{ fontSize: 13 }}>
                            {[item.category, item.color]
                              .filter(Boolean)
                              .join(" · ")}
                          </Body>
                        </View>
                        <Text
                          style={{
                            fontFamily: fonts.bold,
                            fontSize: 14,
                            color: colors.ink,
                          }}
                        >
                          {expanded ? "Hide" : "Shop"}
                        </Text>
                      </Pressable>
                      {expanded && (
                        <PieceOptions
                          piece={{
                            part: "accessory",
                            name: item.name,
                            query: shopQuery(item),
                            closetId: null,
                          }}
                          heading="In stores now"
                        />
                      )}
                    </View>
                  );
                })}
                {library.hasNextPage && (
                  <Button
                    secondary
                    disabled={library.isFetchingNextPage}
                    title="Load more saved items"
                    onPress={() => void library.fetchNextPage()}
                  />
                )}
              </>
            )}
            {!!looks.length && <Heading size={24}>Your AI looks</Heading>}
            {history.isError ? (
              <ErrorState
                message="AI looks couldn’t load."
                retry={() => void history.refetch()}
              />
            ) : (
              looks.map((job) => (
                <Button
                  key={job.id}
                  secondary
                  icon="shopping-bag"
                  title={`Shop your look · ${lookDate(job.created_at)}`}
                  onPress={() =>
                    router.push({
                      pathname: "/result",
                      params: { job: job.id },
                    })
                  }
                />
              ))
            )}
          </>
        )}
      </View>
    </Page>
  );
}
