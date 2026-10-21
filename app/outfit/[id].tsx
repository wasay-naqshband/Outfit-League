import React, { useEffect, useRef, useState } from "react";
import { analytics } from "../../src/lib/analytics";
import { Linking, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Body,
  Button,
  DemoNote,
  ErrorState,
  Figure,
  FlatHeader,
  Heading,
  LoadingSkeleton,
  Page,
} from "../../src/components/ui";
import {
  exploreItem,
  exploreSaveState,
  garments,
  photoGarment,
  sampleGarment,
  sized,
  saveExplore,
} from "../../src/lib/explore";
import { useApp } from "../../src/lib/state";
import { useTryOnDraft } from "../../src/lib/tryon-draft";
import { colors, gradients } from "../../src/theme";
import { cleanSourceUrl } from "../../src/lib/source-url";

export default function OutfitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useApp(),
    client = useQueryClient(),
    draft = useTryOnDraft();
  const query = useQuery({
    queryKey: ["explore-item", session?.user.id, id],
    queryFn: () => exploreItem(id),
    enabled: !!id,
  });
  const saved = useQuery({
    queryKey: ["explore-save", session?.user.id, id],
    queryFn: () => exploreSaveState(id),
    enabled: !!session && !!id,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    item = query.data;
  useEffect(() => {
    if (item)
      analytics.track("explore_outfit_opened", { collection: "sample" });
  }, [item?.id]);
  async function act(action: "save" | "try") {
    if (lock.current || !item) return;
    if (!session) {
      router.push("/auth");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (action === "save") {
        const libraryId = await saveExplore(item.id);
        client.setQueryData(["explore-save", session.user.id, id], libraryId);
        await client.invalidateQueries({
          queryKey: ["library", session.user.id],
        });
      } else if (item.photo_url || item.garment) {
        draft.setGarment(
          item.photo_url
            ? await photoGarment(item.photo_url)
            : await sampleGarment(item.garment!),
        );
        router.push("/(tabs)/try-on");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Page>
      <FlatHeader
        title={item?.name ?? "Outfit details"}
        pill={item?.brand || "Sample look"}
      />
      <View style={{ padding: 20, gap: 16 }}>
        {query.isPending ? (
          <LoadingSkeleton />
        ) : query.isError ? (
          <ErrorState
            message="This outfit couldn’t load. It may no longer be available."
            retry={() => void query.refetch()}
          />
        ) : (
          item && (
            <>
              <LinearGradient
                colors={gradients[item.palette]}
                style={{
                  height: 359,
                  borderRadius: 32,
                  borderWidth: 4,
                  borderColor: colors.white,
                  overflow: "hidden",
                }}
              >
                {item.photo_url ? (
                  <Image
                    source={{ uri: sized(item.photo_url, 900) }}
                    style={{ flex: 1 }}
                    contentFit="cover"
                    contentPosition="top"
                    accessibilityLabel={item.name}
                  />
                ) : (
                  <Figure image={item.image} scale={1.12} />
                )}
              </LinearGradient>
              <Heading size={32}>{item.name}</Heading>
              <Body>
                {item.style} · {item.category}
                {item.brand ? ` · ${item.brand}` : ""}
                {item.price_label ? ` · ${item.price_label}` : ""}
              </Body>
              <Body>{item.description}</Body>
              <Body>Tags: {item.tags}</Body>
              <Body style={{ fontSize: 13 }}>Source: {item.source_label}</Body>
              {item.source_url && (
                <Button
                  secondary
                  title={
                    item.photo_url && item.brand
                      ? `Shop at ${item.brand}`
                      : "Open original source"
                  }
                  onPress={() => {
                    const url = cleanSourceUrl(item.source_url!);
                    if (url)
                      void Linking.openURL(url).catch(() =>
                        setError("This link couldn’t open."),
                      );
                  }}
                />
              )}
              {!!error && <Body>{error}</Body>}
              <Button
                icon="heart"
                disabled={busy}
                title={
                  !session
                    ? "Sign in to save"
                    : busy
                      ? "Please wait…"
                      : saved.data
                        ? "Saved · open in Closet"
                        : "Save to your inspiration"
                }
                onPress={() =>
                  saved.data
                    ? router.push({
                        pathname: "/library-item/[id]",
                        params: { id: saved.data },
                      })
                    : void act("save")
                }
              />
              {saved.isError && (
                <ErrorState
                  message="Saved status couldn’t load. Saving again won’t create a duplicate."
                  retry={() => void saved.refetch()}
                />
              )}
              {item.photo_url ? (
                <Button
                  secondary
                  icon="sparkles"
                  disabled={busy}
                  title={session ? "Try this on" : "Sign in to try this on"}
                  onPress={() => void act("try")}
                />
              ) : item.garment ? (
                <>
                  <Heading size={23}>Garment for Try On</Heading>
                  <Image
                    source={garments[item.garment]}
                    contentFit="contain"
                    style={{
                      height: 220,
                      borderRadius: 24,
                      backgroundColor: colors.white,
                    }}
                    accessibilityLabel={`${item.name} flat garment sample`}
                  />
                  <Body style={{ fontSize: 13 }}>
                    Original sample illustration. For realistic previews,
                    replace it with a clear photo of one garment. Your photo and
                    consent are required; a credit is used only when you press
                    Generate.
                  </Body>
                  <Button
                    secondary
                    icon="sparkles"
                    disabled={busy}
                    title={
                      session ? "Try this look" : "Sign in to try this look"
                    }
                    onPress={() => void act("try")}
                  />
                </>
              ) : (
                <Body>
                  Add your own garment photo in Try On to recreate this style.
                </Body>
              )}
              {!item.photo_url && (
                <Button
                  secondary
                  icon="shopping-bag"
                  title="Shop similar styles"
                  onPress={() =>
                    router.push({
                      pathname: "/shop",
                      params: { look: item.id },
                    })
                  }
                />
              )}
              <DemoNote
                text={
                  item.photo_url
                    ? `Beta preview · photo from the ${item.brand} store, not affiliated · price may change`
                    : "Sample inspiration · no retailer, price or AI result is implied"
                }
              />
            </>
          )
        )}
      </View>
    </Page>
  );
}
