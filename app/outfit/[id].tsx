import React, { useEffect, useRef, useState } from "react";
import {
  ExploreProduct,
  ProductDetailSkeleton,
} from "../../src/components/ExploreProduct";
import { analytics } from "../../src/lib/analytics";
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
  Page,
} from "../../src/components/ui";
import {
  exploreItem,
  exploreSaveState,
  garments,
  photoGarment,
  sampleGarment,
  saveExplore,
} from "../../src/lib/explore";
import { useApp } from "../../src/lib/state";
import { useTryOnDraft } from "../../src/lib/tryon-draft";
import { colors } from "../../src/theme";
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
  if (query.isPending)
    return <ProductDetailSkeleton onBack={() => router.back()} />;
  if (query.isError || !item)
    return (
      <Page>
        <FlatHeader title="Outfit details" />
        <View style={{ padding: 20 }}>
          <ErrorState
            message="This outfit couldn’t load. It may no longer be available."
            retry={() => void query.refetch()}
          />
        </View>
      </Page>
    );

  return (
    <ExploreProduct
      item={item}
      saved={!!saved.data}
      busy={busy}
      error={error}
      onBack={() => router.back()}
      onShop={
        item.source_url
          ? () => {
              try {
                const url = cleanSourceUrl(item.source_url!);
                if (url)
                  void Linking.openURL(url).catch(() =>
                    setError("This link couldn’t open."),
                  );
              } catch {
                setError("This link couldn’t open.");
              }
            }
          : undefined
      }
      onSave={() =>
        saved.data
          ? router.push({
              pathname: "/library-item/[id]",
              params: { id: saved.data },
            })
          : void act("save")
      }
      onTryOn={
        item.photo_url || item.garment ? () => void act("try") : undefined
      }
    >
      {saved.isError && (
        <ErrorState
          message="Saved status couldn’t load. Saving again won’t create a duplicate."
          retry={() => void saved.refetch()}
        />
      )}
      {!item.photo_url && (
        <View style={{ marginTop: 20, gap: 14 }}>
          {item.garment ? (
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
                accessibilityLabel={item.name + " flat garment sample"}
              />
              <Body style={{ fontSize: 13 }}>
                Original sample illustration. For realistic previews, replace it
                with a clear photo of one garment. Your photo and consent are
                required; a credit is used only when you press Generate.
              </Body>
            </>
          ) : (
            <Body>
              Add your own garment photo in Try On to recreate this style.
            </Body>
          )}
          <Button
            secondary
            icon="shopping-bag"
            title="Shop similar styles"
            onPress={() =>
              router.push({ pathname: "/shop", params: { look: item.id } })
            }
          />
        </View>
      )}
    </ExploreProduct>
  );
}
