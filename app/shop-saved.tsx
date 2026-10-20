import React from "react";
import { Pressable, View } from "react-native";
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
  LoadingSkeleton,
  Page,
} from "../src/components/ui";
import { libraryPage } from "../src/lib/library";
import { useApp } from "../src/lib/state";
import { useHistory } from "../src/lib/queries";
import { art } from "../src/data";
import { colors } from "../src/theme";
export default function ShopSaved() {
  const { session } = useApp(),
    history = useHistory();
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
      <FlatHeader title="Shop saved looks" pill="Your selection" />
      <View style={{ padding: 20, gap: 16 }}>
        <Body>
          Choose inspiration or clothing from your private collection. We use
          saved details to search the sample catalog; automatic garment
          recognition and live retailer feeds are not connected.
        </Body>
        <Button
          secondary
          title="Browse the sample catalog"
          onPress={() => router.push("/shop")}
        />
        {!session ? (
          <Button
            title="Sign in to choose private saved looks"
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
                {items.map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Shop ${item.name}`}
                    onPress={() =>
                      router.push({
                        pathname: "/shop",
                        params: { library: item.id },
                      })
                    }
                    style={{
                      padding: 14,
                      borderRadius: 24,
                      backgroundColor: colors.white,
                      flexDirection: "row",
                      gap: 14,
                      alignItems: "center",
                    }}
                  >
                    {(item.photoUrl || item.explore_image) && (
                      <Image
                        source={
                          item.photoUrl
                            ? { uri: item.photoUrl }
                            : art[item.explore_image!]
                        }
                        contentFit="contain"
                        cachePolicy="none"
                        style={{
                          width: 65,
                          height: 75,
                          borderRadius: 16,
                          backgroundColor: colors.chip,
                        }}
                      />
                    )}
                    <View style={{ flex: 1 }}>
                      <Heading size={19}>{item.name}</Heading>
                      <Body style={{ fontSize: 13 }}>
                        {item.category} · private saved details
                      </Body>
                    </View>
                  </Pressable>
                ))}
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
            <Heading size={24}>Completed AI looks</Heading>
            {history.isError ? (
              <ErrorState
                message="AI looks couldn’t load."
                retry={() => void history.refetch()}
              />
            ) : (
              history.data
                ?.filter((item) => item.status === "completed")
                .map((item) => (
                  <Button
                    key={item.id}
                    secondary
                    title={`Shop AI preview · ${new Date(item.created_at).toLocaleString()}`}
                    onPress={() =>
                      router.push({
                        pathname: "/shop",
                        params: { job: item.id },
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
