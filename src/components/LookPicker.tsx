import React, { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { Body, ErrorState, Heading, Icon, LoadingSkeleton } from "./ui";
import { myLooks } from "../lib/battles";
import { pickPhoto } from "../lib/photos";
import { saveLibraryItem } from "../lib/library";
import type { LocalPhoto } from "../types/tryon";
import { useApp } from "../lib/state";
import { colors, shadow } from "../theme";

const LETTERS = ["A", "B", "C", "D"];
const tile = {
  width: "31%",
  aspectRatio: 0.75,
  borderRadius: 18,
  borderWidth: 3,
  overflow: "hidden",
  backgroundColor: colors.white,
} as const;

// ponytail: an imported photo is saved as a private Closet item so the server
// can copy it like any other look; give battles their own upload if that
// clutter matters.
const saved = new Map<string, string>();
export async function lookSource(id: string, imports: LocalPhoto[]) {
  const photo = imports.find((p) => p.uri === id);
  if (!photo) return { kind: "job", id };
  let item = saved.get(id);
  if (!item) {
    item = await saveLibraryItem(
      "inspiration",
      {
        name: "Battle photo",
        category: "Other",
        color: "",
        brand: "",
        notes: "",
        tags: "",
        source_url: null,
      },
      photo,
    );
    saved.set(id, item);
  }
  return { kind: "library", id: item };
}

// Import tile, then gallery imports and completed try-ons; selected ones show
// their letter. Signed-out guests get just the import tile.
export function LookPicker({
  selected,
  max,
  onChange,
  imports,
  onImports,
}: {
  selected: string[];
  max: number;
  onChange: (ids: string[]) => void;
  imports: LocalPhoto[];
  onImports: (photos: LocalPhoto[]) => void;
}) {
  const { session } = useApp();
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState("");
  const looks = useQuery({
    queryKey: ["my-looks", session?.user.id],
    queryFn: myLooks,
    enabled: !!session,
    staleTime: 300000,
  });
  async function importPhoto() {
    if (picking) return;
    setPicking(true);
    setError("");
    try {
      const photo = await pickPhoto(false, 1600);
      if (!photo) return;
      onImports([photo, ...imports]);
      if (max === 1) onChange([photo.uri]);
      else if (selected.length < max) onChange([...selected, photo.uri]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try another photo.");
    } finally {
      setPicking(false);
    }
  }
  const all = [
    ...imports.map((p) => ({ id: p.uri, url: p.uri })),
    ...(looks.data ?? []),
  ];
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Import from gallery"
          disabled={picking}
          onPress={() => void importPhoto()}
          style={{
            ...tile,
            borderColor: colors.ink,
            borderStyle: "dashed",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: 6,
          }}
        >
          {picking ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Icon name="image" size={26} />
          )}
          <Heading size={13} style={{ textAlign: "center" }}>
            Import from gallery
          </Heading>
        </Pressable>
        {all.map((look) => {
          const at = selected.indexOf(look.id);
          return (
            <Pressable
              key={look.id}
              accessibilityRole="button"
              accessibilityState={{ selected: at >= 0 }}
              accessibilityLabel={at >= 0 ? `Look ${LETTERS[at]}` : "Pick look"}
              onPress={() =>
                onChange(
                  at >= 0
                    ? selected.filter((id) => id !== look.id)
                    : max === 1
                      ? [look.id]
                      : selected.length < max
                        ? [...selected, look.id]
                        : selected,
                )
              }
              style={{
                ...tile,
                borderColor: at >= 0 ? colors.ink : colors.white,
                ...shadow(0.06),
              }}
            >
              <Image
                source={{ uri: look.url }}
                contentFit="cover"
                contentPosition="top"
                style={{ width: "100%", height: "100%" }}
              />
              {at >= 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: 6,
                    left: 6,
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: colors.ink,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Heading size={13} style={{ color: colors.yellow }}>
                    {max === 1 ? "✓" : LETTERS[at]}
                  </Heading>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      {!!session && looks.isPending && <LoadingSkeleton />}
      {looks.isError && (
        <ErrorState
          message="Your looks couldn’t load."
          retry={() => void looks.refetch()}
        />
      )}
      {!!error && <Body style={{ color: colors.ink }}>{error}</Body>}
    </View>
  );
}
