import React, { useState } from "react";
import { Linking, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  Body,
  Button,
  ErrorState,
  FlatHeader,
  LoadingSkeleton,
  Page,
} from "../src/components/ui";
import { Bone, Grid, Retry } from "../src/components/ShopTab";
import { cleanSourceUrl, libraryItem, shopQuery } from "../src/lib/library";
import { pieceLink, shopPiece, type Lookalike } from "../src/lib/tryon-api";
import { useApp } from "../src/lib/state";

// Saved inspiration → Shop similar styles: just the picks, each opening its
// store page. The exact piece comes first when its source is known.
export default function ShopSimilar() {
  const { session } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [opening, setOpening] = useState("");
  const [error, setError] = useState("");
  const item = useQuery({
    queryKey: ["library-item", session?.user.id, id],
    queryFn: () => libraryItem(id),
    enabled: !!session && !!id,
  });
  const picks = useQuery({
    queryKey: [
      "shop-piece",
      item.data && shopQuery(item.data),
      item.data?.photo_path ? item.data.id : undefined,
    ],
    queryFn: () =>
      shopPiece(
        shopQuery(item.data!),
        item.data!.photo_path ? item.data!.id : undefined,
      ),
    enabled: !!item.data,
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });
  const exact = item.data?.source_url && cleanSourceUrl(item.data.source_url);

  async function open(url: string, product?: Lookalike) {
    if (opening) return;
    setOpening(url);
    setError("");
    try {
      await Linking.openURL(product ? (await pieceLink(product)).url : url);
    } catch {
      setError("This store link couldn’t open. Try again.");
    } finally {
      setOpening("");
    }
  }

  return (
    <Page>
      <FlatHeader title="Similar styles" />
      <View style={{ paddingHorizontal: 20, gap: 16, paddingBottom: 100 }}>
        {item.isPending ? (
          <LoadingSkeleton />
        ) : item.isError ? (
          <ErrorState
            message="This item couldn’t load."
            retry={() => void item.refetch()}
          />
        ) : (
          <>
            {!!exact && (
              <Button
                icon="shopping-bag"
                title="Shop the exact piece"
                disabled={!!opening}
                onPress={() => void open(exact)}
              />
            )}
            {!!error && <Body style={{ color: "#A3321F" }}>{error}</Body>}
            {picks.isPending ? (
              <View style={{ flexDirection: "row", gap: 12 }}>
                {[0, 1].map((i) => (
                  <Bone
                    key={i}
                    style={{ flex: 1, height: 300, borderRadius: 24 }}
                  />
                ))}
              </View>
            ) : picks.isError ? (
              <Retry onPress={() => void picks.refetch()} />
            ) : !picks.data.items.length ? (
              <Body>No similar styles found right now.</Body>
            ) : (
              <Grid
                items={picks.data.items}
                opening={opening}
                onShop={(product) => void open(product.url, product)}
              />
            )}
          </>
        )}
      </View>
    </Page>
  );
}
