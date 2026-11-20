import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  AppHeader,
  DemoNote,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  OutfitCard,
  Page,
} from "../components/ui";
import { EXPLORE_PAGE_SIZE, explorePage, cardOutfit } from "../lib/explore";
import { useApp } from "../lib/state";
import { styleLabel, useOnboarding } from "../lib/onboarding";

const CHIPS = [
  "Trending",
  "Streetwear",
  "Y2K",
  "Minimal",
  "Casual",
  "Vintage",
  "Athleisure",
  "Formal",
  "Tops",
  "Shirts",
  "Knitwear",
  "Hoodies",
  "Jackets",
  "Denim",
  "Bottoms",
  "Dresses",
  "Skirts",
  "Shorts",
  "Shoes",
  "Accessories",
  "Swimwear",
];

export default function Feed() {
  const { session } = useApp();
  const insets = useSafeAreaInsets();
  const list = React.useRef<FlatList>(null);
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState("Trending");
  // Open on the first picked style Explore has a filter for.
  const picked = useOnboarding()
    .answers.styles.map(styleLabel)
    .find((label) => CHIPS.includes(label));
  const opened = React.useRef(false);
  useEffect(() => {
    if (picked && !opened.current) setSelected(picked);
    opened.current = true;
  }, [picked]);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const feed = useInfiniteQuery({
    queryKey: ["explore", session?.user.id, query, selected],
    initialPageParam: -1,
    queryFn: ({ pageParam }) => explorePage(query, selected, pageParam),
    getNextPageParam: (page) =>
      page.length === EXPLORE_PAGE_SIZE
        ? page[page.length - 1]!.rank
        : undefined,
    staleTime: 30000,
  });
  const data = feed.data?.pages.flat() ?? [];
  const filtered = !!query || selected !== "Trending";
  useEffect(() => {
    list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [query, selected]);
  return (
    <Page scroll={false}>
      <FlatList
        ref={list}
        data={data}
        numColumns={2}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 16) + 100,
        }}
        columnWrapperStyle={{ gap: 14, paddingHorizontal: 17 }}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
        onEndReachedThreshold={2}
        onEndReached={() => {
          if (
            feed.hasNextPage &&
            !feed.isFetching &&
            !feed.isFetchNextPageError
          )
            void feed.fetchNextPage();
        }}
        ListHeaderComponent={
          <AppHeader
            title="Explore"
            query={search}
            onQuery={setSearch}
            chips={CHIPS}
            selected={selected}
            onSelect={setSelected}
          />
        }
        renderItem={({ item, index }) => (
          <View style={{ flex: 1, maxWidth: "50%", paddingTop: 14 }}>
            <OutfitCard
              outfit={cardOutfit(item)}
              height={index % 2 === 0 ? 258 : 228}
              label={index === 0}
              caption={item.price_label || "Sample"}
              source={!!item.photo_url}
              sticker={
                !filtered && index < 2
                  ? index === 0
                    ? "Trending"
                    : "New"
                  : undefined
              }
              onTry={() =>
                router.push({
                  pathname: "/outfit/[id]",
                  params: { id: item.id },
                })
              }
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={{ padding: 20 }}>
            {feed.isPending ? (
              <LoadingSkeleton />
            ) : feed.isError ? (
              <ErrorState
                message="Explore couldn’t load."
                retry={() => void feed.refetch()}
              />
            ) : (
              <EmptyState
                title="No fits found."
                message="Try a different name, brand, category or style."
                action="Clear filters"
                onPress={() => {
                  setSearch("");
                  setQuery("");
                  setSelected("Trending");
                }}
              />
            )}
          </View>
        }
        ListFooterComponent={
          <View style={{ padding: 20, gap: 14 }}>
            {feed.isFetchingNextPage && (
              <ActivityIndicator accessibilityLabel="Loading more outfits" />
            )}
            {feed.isFetchNextPageError && (
              <ErrorState
                message="More outfits couldn’t load."
                retry={() => void feed.fetchNextPage()}
              />
            )}
            <DemoNote text="Product photos from brand stores · prices and availability may change" />
          </View>
        }
      />
    </Page>
  );
}
