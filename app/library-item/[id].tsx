import React, { useState } from "react";
import { Linking, View } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Body,
  Button,
  ErrorState,
  FlatHeader,
  Heading,
  LoadingSkeleton,
  Page,
} from "../../src/components/ui";
import {
  cleanSourceUrl,
  deleteLibraryItem,
  libraryGarment,
  libraryItem,
} from "../../src/lib/library";
import { useTryOnDraft } from "../../src/lib/tryon-draft";
import { useApp } from "../../src/lib/state";
import { colors } from "../../src/theme";
import { art } from "../../src/data";

export default function LibraryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useApp();
  const query = useQuery({
    queryKey: ["library-item", session?.user.id, id],
    queryFn: () => libraryItem(id),
    enabled: !!session && !!id,
    refetchInterval: 240000,
  });
  const [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const client = useQueryClient(),
    draft = useTryOnDraft();
  const item = query.data;
  async function act(action: "delete" | "try") {
    if (busy || !item) return;
    setBusy(true);
    setError("");
    try {
      if (action === "delete") {
        await deleteLibraryItem(item.id);
        client.removeQueries({
          queryKey: ["library-item", session?.user.id, item.id],
        });
        await client.invalidateQueries({ queryKey: ["library"] });
        await client.invalidateQueries({ queryKey: ["explore-save"] });
        router.replace("/(tabs)/closet");
      } else {
        draft.setGarment(await libraryGarment(item));
        router.push("/(tabs)/try-on");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <FlatHeader title="Your collection" pill="Private" />
      <View style={{ padding: 20, gap: 16 }}>
        {!session ? (
          <Button
            title="Sign in to open your item"
            onPress={() => router.push("/auth")}
          />
        ) : query.isPending ? (
          <LoadingSkeleton />
        ) : query.isError ? (
          <ErrorState
            message="This item couldn’t load. It may have been deleted."
            retry={() => void query.refetch()}
          />
        ) : (
          item && (
            <>
              {(item.photoUrl || item.explore_image) && (
                <Image
                  source={
                    item.photoUrl
                      ? { uri: item.photoUrl }
                      : art[item.explore_image!]
                  }
                  cachePolicy="none"
                  contentFit="contain"
                  style={{
                    height: 340,
                    borderRadius: 30,
                    backgroundColor: "#DCD5FF",
                    borderWidth: 4,
                    borderColor: colors.white,
                  }}
                />
              )}
              <Heading size={34}>{item.name}</Heading>
              <Body>
                {[item.category, item.color, item.brand]
                  .filter(Boolean)
                  .join(" · ")}
              </Body>
              {!!item.tags && <Body>Tags: {item.tags}</Body>}
              {!!item.notes && <Body>{item.notes}</Body>}
              {item.source_url && (
                <Button
                  secondary
                  title="Open original source"
                  onPress={() => {
                    const url = cleanSourceUrl(item.source_url!);
                    if (url)
                      void Linking.openURL(url).catch(() =>
                        setError("This link couldn’t open."),
                      );
                  }}
                />
              )}
              <Body style={{ fontSize: 13 }}>
                {item.kind === "wardrobe"
                  ? "From your wardrobe"
                  : "Saved inspiration"}{" "}
                · Added {new Date(item.created_at).toLocaleDateString()}
              </Body>
              {!!error && <Body>{error}</Body>}
              {item.explore_id && (
                <Body style={{ fontSize: 13 }}>
                  Saved Explore sample · illustrated inspiration
                </Body>
              )}
              {item.photo_path || item.explore_garment ? (
                <>
                  <Button
                    icon="sparkles"
                    title={busy ? "Please wait…" : "Try this on"}
                    disabled={busy}
                    onPress={() => void act("try")}
                  />
                  <Body style={{ fontSize: 13 }}>
                    Choose a photo showing one garment for the best result.
                    Preview quality varies by clothing type. A credit is used
                    only when you press Generate.
                    {item.explore_garment && !item.photo_path
                      ? " This uses the sample flat garment illustration, not the character artwork."
                      : ""}
                  </Body>
                </>
              ) : (
                <Body>
                  Add a screenshot or garment photo to use this inspiration in
                  Try On. Source links are saved without extracting social
                  media.
                </Body>
              )}
              <Button
                secondary
                icon="shopping-bag"
                title="Shop similar styles"
                disabled={busy}
                onPress={() =>
                  router.push({
                    pathname: "/shop",
                    params: { library: item.id },
                  })
                }
              />
              <Button
                secondary
                title="Edit item"
                disabled={busy}
                onPress={() =>
                  router.push({
                    pathname: "/library-edit",
                    params: { id: item.id },
                  })
                }
              />
              {confirm ? (
                <View
                  style={{
                    backgroundColor: colors.chip,
                    padding: 18,
                    gap: 12,
                    borderRadius: 24,
                  }}
                >
                  <Body>
                    Delete this item and its saved photo? This can’t be undone.
                    Existing generated looks are kept separately.
                  </Body>
                  <Button
                    title={busy ? "Deleting…" : "Delete item and photo"}
                    disabled={busy}
                    onPress={() => void act("delete")}
                  />
                  <Button
                    secondary
                    title="Keep item"
                    disabled={busy}
                    onPress={() => setConfirm(false)}
                  />
                </View>
              ) : (
                <Button
                  secondary
                  title="Delete item"
                  disabled={busy}
                  onPress={() => setConfirm(true)}
                />
              )}
            </>
          )
        )}
      </View>
    </Page>
  );
}
