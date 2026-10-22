import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  AppHeader,
  Button,
  DarkPromoCard,
  DemoNote,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  OutfitCard,
  Page,
} from "../components/ui";
import { explorePage, cardOutfit } from "../lib/explore";
import { useApp } from "../lib/state";
import { styleLabel, useOnboarding } from "../lib/onboarding";

const CHIPS = ["Trending", "Streetwear", "Minimal", "Y2K"];

export default function Feed() {
  const { session } = useApp();
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
      page.length === 12 ? page[11]!.rank : undefined,
    staleTime: 30000,
  });
  const data = feed.data?.pages.flat() ?? [];
  const filtered = !!query || selected !== "Trending";
  return (
    <Page>
      <AppHeader
        title="Explore"
        query={search}
        onQuery={setSearch}
        chips={CHIPS}
        selected={selected}
        onSelect={setSelected}
      />
      {feed.isPending ? (
        <View style={{ padding: 20 }}>
          <LoadingSkeleton />
        </View>
      ) : feed.isError && !data.length ? (
        <View style={{ padding: 20 }}>
          <ErrorState
            message="Explore couldn’t load."
            retry={() => void feed.refetch()}
          />
        </View>
      ) : (
        <>
          <View
            style={{
              flexDirection: "row",
              gap: 14,
              paddingHorizontal: 17,
              paddingTop: 18,
            }}
          >
            {[0, 1].map((column) => (
              <View key={column} style={{ flex: 1, gap: 14 }}>
                {data
                  .filter((_, i) => i % 2 === column)
                  .map((item, index) => (
                    <React.Fragment key={item.id}>
                      <OutfitCard
                        outfit={cardOutfit(item)}
                        height={
                          index === 0
                            ? column === 0
                              ? 258
                              : 201
                            : column === 1
                              ? 200
                              : 228
                        }
                        label={column === 0 && index === 0}
                        caption={item.price_label || "Sample"}
                        source={!!item.photo_url}
                        sticker={
                          !filtered && index === 0
                            ? column === 0
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
                      {column === 1 && index === 0 && !filtered && (
                        <DarkPromoCard />
                      )}
                    </React.Fragment>
                  ))}
              </View>
            ))}
          </View>
          <View style={{ padding: 20, gap: 14 }}>
            {!data.length && (
              <EmptyState
                title="No fits found."
                message="Try a different name, brand, tag or style."
                action="Clear filters"
                onPress={() => {
                  setSearch("");
                  setQuery("");
                  setSelected("Trending");
                }}
              />
            )}
            {feed.isFetchNextPageError && (
              <ErrorState
                message="More outfits couldn’t load."
                retry={() => void feed.fetchNextPage()}
              />
            )}
            {feed.hasNextPage && !feed.isFetchNextPageError && (
              <Button
                secondary
                disabled={feed.isFetchingNextPage}
                title={
                  feed.isFetchingNextPage ? "Loading…" : "Load more outfits"
                }
                onPress={() => void feed.fetchNextPage()}
              />
            )}
          </View>
        </>
      )}
      <DemoNote text="Beta preview · product photos from Pakistani brand stores, not affiliated · prices may change" />
    </Page>
  );
}
