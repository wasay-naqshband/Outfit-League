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
import { useHistory } from "../lib/queries";
import { HistoryRow } from "../../app/history";
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
  const history = useHistory();
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
        chips={["Saved", "My Closet", "AI Looks", "Shop"]}
        selected={selected}
        onSelect={(value) =>
          value === "Shop" ? router.push("/shop-saved") : setSelected(value)
        }
      />
      <View style={{ padding: 18, gap: 18 }}>
        {session && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="AI Stylist: what should I wear?"
            onPress={() => router.push("/stylist")}
            style={{
              backgroundColor: colors.ink,
              borderRadius: 28,
              padding: 20,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              ...shadow(0.12),
            }}
          >
            <Icon name="sparkles" size={30} color={colors.yellow} />
            <View style={{ flex: 1, gap: 4 }}>
              <Heading size={21} style={{ color: colors.white }}>
                What should I wear?
              </Heading>
              <Body style={{ fontSize: 13, color: colors.white, opacity: 0.8 }}>
                Your AI stylist picks from your closet and finds your colours.
              </Body>
            </View>
            <Icon name="chevron-right" size={20} color={colors.white} />
          </Pressable>
        )}
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
        ) : selected === "AI Looks" ? (
          <>
            <Heading>Your fits, reimagined.</Heading>
            <Body>
              Open a look to compare, save or share. Failed and pending try-ons
              are in your full history.
            </Body>
            {history.isPending ? (
              <LoadingSkeleton />
            ) : history.isError ? (
              <ErrorState
                message="Your looks couldn’t load."
                retry={() => void history.refetch()}
              />
            ) : (
              <>
                {(history.data ?? [])
                  .filter((job) => job.status === "completed")
                  .map((job) => (
                    <HistoryRow key={job.id} job={job} />
                  ))}
                {!history.data?.some((job) => job.status === "completed") && (
                  <EmptyState
                    title="Your next look starts here."
                    message="Generate a private try-on and it will appear in this collection."
                    action="Try something on"
                    onPress={() => router.push("/(tabs)/try-on")}
                  />
                )}
              </>
            )}
            <Button
              secondary
              title="Open full try-on history"
              onPress={() => router.push("/history")}
            />
          </>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                kind === "wardrobe" ? "Add clothing item" : "Save inspiration"
              }
              onPress={() =>
                router.push({ pathname: "/library-edit", params: { kind } })
              }
            >
              <LinearGradient
                colors={kind === "wardrobe" ? gradients.mint : gradients.pink}
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
                <Heading size={28}>
                  {kind === "wardrobe"
                    ? "Build your real-life closet."
                    : "Found a fit you love?"}
                </Heading>
                <Body>
                  {kind === "wardrobe"
                    ? "Add a photo, name it, and try it on anytime."
                    : "Save a link, screenshot or photo. Keep the inspiration."}
                </Body>
              </LinearGradient>
            </Pressable>
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
