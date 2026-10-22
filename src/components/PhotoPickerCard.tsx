import React from "react";
import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";
import { Icon } from "./ui";
import { colors, fonts, shadow } from "../theme";
import type { LocalPhoto } from "../types/tryon";
// One tile of the 2×2 Try On grid; equal height with or without a photo.
export function PhotoPickerCard({
  label,
  hint,
  photo,
  onChoose,
  onRemove,
  disabled,
}: {
  label: string;
  hint?: string;
  photo: LocalPhoto | null;
  onChoose: () => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexBasis: "45%", flexGrow: 1 }}>
      <Pressable
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={(photo ? "Replace " : "Choose ") + label}
        onPress={onChoose}
        style={{
          height: 190,
          borderRadius: 28,
          borderWidth: 4,
          borderColor: colors.white,
          backgroundColor: label === "Your photo" ? "#DCD5FF" : "#CFF5E4",
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          ...shadow(0.08),
        }}
      >
        {photo ? (
          <>
            <Image
              source={{ uri: photo.uri }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              cachePolicy="none"
            />
            <Text
              style={{
                position: "absolute",
                left: 8,
                bottom: 8,
                backgroundColor: colors.white,
                borderRadius: 12,
                paddingHorizontal: 10,
                paddingVertical: 4,
                overflow: "hidden",
                fontFamily: fonts.bold,
                fontSize: 12,
                color: colors.ink,
              }}
            >
              {label}
            </Text>
          </>
        ) : (
          <>
            <Icon name={hint ? "plus" : "image"} size={30} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>
              {label}
            </Text>
            {!!hint && (
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 12,
                  color: colors.text3,
                }}
              >
                {hint}
              </Text>
            )}
          </>
        )}
      </Pressable>
      {photo && (
        <Pressable
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={"Remove " + label}
          onPress={onRemove}
          hitSlop={8}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.white,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Icon name="x" size={16} />
        </Pressable>
      )}
    </View>
  );
}
