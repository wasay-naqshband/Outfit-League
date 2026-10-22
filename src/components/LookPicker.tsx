import React from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Body, Button, ErrorState, Heading, LoadingSkeleton } from "./ui";
import { myLooks } from "../lib/battles";
import { useApp } from "../lib/state";
import { colors, shadow } from "../theme";

const LETTERS = ["A", "B", "C", "D"];

// Grid of the person's completed try-ons; selected ones show their letter.
export function LookPicker({
  selected,
  max,
  onChange,
}: {
  selected: string[];
  max: number;
  onChange: (ids: string[]) => void;
}) {
  const { session } = useApp();
  const looks = useQuery({
    queryKey: ["my-looks", session?.user.id],
    queryFn: myLooks,
    enabled: !!session,
    staleTime: 300000,
  });
  if (looks.isPending) return <LoadingSkeleton />;
  if (looks.isError)
    return (
      <ErrorState
        message="Your looks couldn’t load."
        retry={() => void looks.refetch()}
      />
    );
  if (!looks.data.length)
    return (
      <View
        style={{
          backgroundColor: colors.white,
          borderRadius: 24,
          padding: 20,
          gap: 12,
          alignItems: "center",
        }}
      >
        <Heading size={20}>No looks yet</Heading>
        <Body style={{ textAlign: "center" }}>
          Do a try-on first, then come back to battle it.
        </Body>
        <Button
          title="Go to Try On"
          icon="sparkles"
          onPress={() => router.push("/(tabs)/try-on")}
        />
      </View>
    );
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {looks.data.map((look) => {
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
              width: "31%",
              aspectRatio: 0.75,
              borderRadius: 18,
              borderWidth: 3,
              borderColor: at >= 0 ? colors.ink : colors.white,
              overflow: "hidden",
              backgroundColor: colors.white,
              ...shadow(0.06),
            }}
          >
            <Image
              source={{ uri: look.url }}
              contentFit="cover"
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
  );
}
