import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  AppHeader,
  Body,
  Button,
  EmptyState,
  ErrorState,
  Heading,
  Icon,
  LoadingSkeleton,
  Page,
  StickerBadge,
} from "../components/ui";
import { useApp } from "../lib/state";
import { libraryPage, type LibraryItem } from "../lib/library";
import { ShopTab } from "../components/ShopTab";
import { AiLooksTab, StylistCard } from "../components/AiLooks";
import { colors, gradients, shadow } from "../theme";
import { art } from "../data";

export default function Closet() {
  const { session } = useApp();
  const [selected, setSelected] = useState("Saved"),
    [search, setSearch] = useState("");
  const query = useInfiniteQuery({
    queryKey: ["library", session?.user.id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => libraryPage(pageParam),
    getNextPageParam: (page) =>
      page.length === 40
        ? `${page[39]!.created_at}|${page[39]!.id}`
        : undefined,
    enabled: !!session,
    refetchInterval: 240000,
    staleTime: 30000,
  });
  const kind = selected === "My Closet" ? "wardrobe" : "inspiration";
  const items = (query.data?.pages.flat() ?? []).filter(
    (item) =>
      item.kind === kind &&
      [item.name, item.category, item.tags, item.color, item.brand, item.notes]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <Page>
      <AppHeader
        title="Closet"
        query={search}
        onQuery={setSearch}
        placeholder={
          selected === "AI Looks"
            ? "Search your looks"
            : selected === "Shop"
              ? "Search stores"
              : undefined
        }
        chips={["Saved", "My Closet", "AI Looks", "Shop"]}
        selected={selected}
        onSelect={setSelected}
      />
      <View style={{ padding: 18, gap: 18 }}>
        {session && selected !== "Shop" && <StylistCard />}
        {!session ? (
          <>
            <LinearGradient
              colors={gradients.lavender}
              style={{
                padding: 24,
                borderRadius: 30,
                borderWidth: 4,
                borderColor: colors.white,
                gap: 14,
              }}
            >
              <Icon name="hanger" size={42} />
              <Heading size={32}>A home for your style.</Heading>
              <Body>
                Save the looks you love. Keep the clothes you own. Your personal
                fashion library stays private.
              </Body>
              <Button
                title="Sign in to your Closet"
                onPress={() => router.push("/auth")}
              />
            </LinearGradient>
            <Body style={{ fontSize: 13 }}>
              Browse sample outfits in Explore. Your personal Closet starts with
              your own saves.
            </Body>
          </>
        ) : selected === "Shop" ? (
          <ShopTab search={search} />
        ) : selected === "AI Looks" ? (
          <AiLooksTab search={search} />
        ) : (
          <>
            {kind === "wardrobe" && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add clothing item"
                onPress={() =>
                  router.push({ pathname: "/library-edit", params: { kind } })
                }
              >
                <LinearGradient
                  colors={gradients.mint}
                  style={{
                    borderRadius: 28,
                    borderWidth: 4,
                    borderColor: colors.white,
                    padding: 20,
                    gap: 10,
                    ...shadow(0.08),
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Icon name="plus" size={30} />
                    <StickerBadge>Just for you</StickerBadge>
                  </View>
                  <Heading size={28}>Add clothes to your closet.</Heading>
                  <Body>Snap or pick a piece. We’ll name and sort it.</Body>
                </LinearGradient>
              </Pressable>
            )}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Heading size={23}>
                {kind === "wardrobe" ? "Your clothes" : "Saved inspiration"}
              </Heading>
              <Body style={{ fontSize: 12 }}>Private collection</Body>
            </View>
            {query.isPending ? (
              <LoadingSkeleton />
            ) : query.isError ? (
              <ErrorState
                message="Your Closet couldn’t load."
                retry={() => void query.refetch()}
              />
            ) : (
              <>
                <View style={{ flexDirection: "row", gap: 14 }}>
                  {[0, 1].map((column) => (
                    <View key={column} style={{ flex: 1, gap: 16 }}>
                      {items
                        .filter((_, i) => i % 2 === column)
                        .map((item, i) => (
                          <LibraryCard
                            key={item.id}
                            item={item}
                            index={i + column}
                          />
                        ))}
                    </View>
                  ))}
                </View>
                {!items.length && (
                  <EmptyState
                    title={
                      search
                        ? "No matching fits."
                        : kind === "wardrobe"
                          ? "Make room for your fits."
                          : "Your moodboard starts here."
                    }
                    message={
                      search
                        ? "Try another name, color, brand or tag. Load more below to search older items."
                        : "Add your first item using the colorful card above. No AI credits needed."
                    }
                  />
                )}
                {query.hasNextPage && (
                  <Button
                    secondary
                    disabled={query.isFetchingNextPage}
                    title={
                      query.isFetchingNextPage ? "Loading…" : "Load more items"
                    }
                    onPress={() => void query.fetchNextPage()}
                  />
                )}
              </>
            )}
          </>
        )}
      </View>
    </Page>
  );
}
function LibraryCard({ item, index }: { item: LibraryItem; index: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.name}`}
      onPress={() =>
        router.push({ pathname: "/library-item/[id]", params: { id: item.id } })
      }
      style={{
        backgroundColor: colors.white,
        borderRadius: 28,
        borderWidth: 4,
        borderColor: colors.white,
        overflow: "hidden",
        ...shadow(0.08),
      }}
    >
      <LinearGradient
        colors={index % 2 ? gradients.lavender : gradients.sun}
        style={{
          height: index % 2 ? 190 : 220,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {item.photoUrl || item.explore_image ? (
          <Image
            source={
              item.photoUrl ? { uri: item.photoUrl } : art[item.explore_image!]
            }
            cachePolicy="none"
            style={{ width: "100%", height: "100%" }}
            contentFit={item.photoUrl ? "cover" : "contain"}
          />
        ) : (
          <View style={{ padding: 16, gap: 12, alignItems: "center" }}>
            <Icon name={item.source_url ? "heart" : "hanger"} size={40} />
            <Body>{item.source_url ? "Saved link" : "Add a photo"}</Body>
          </View>
        )}
      </LinearGradient>
      <View style={{ padding: 10, gap: 5 }}>
        <Heading size={19}>{item.name}</Heading>
        <Body style={{ fontSize: 12 }}>
          {item.category}
          {item.color ? ` · ${item.color}` : ""}
        </Body>
      </View>
    </Pressable>
  );
}
