import React from "react";
import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";
import { Icon } from "./ui";
import { colors, fonts, shadow } from "../theme";
import type { LocalPhoto } from "../types/tryon";
export function PhotoPickerCard({
  label,
  photo,
  onChoose,
  onRemove,
  disabled,
}: {
  label: string;
  photo: LocalPhoto | null;
  onChoose: () => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Pressable
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={(photo ? "Replace " : "Choose ") + label}
        onPress={onChoose}
        style={{
          height: 200,
          borderRadius: 28,
          borderWidth: 4,
          borderColor: colors.white,
          backgroundColor: label === "Your photo" ? "#DCD5FF" : "#CFF5E4",
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          ...shadow(0.08),
        }}
      >
        {photo ? (
          <Image
            source={{ uri: photo.uri }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            cachePolicy="none"
          />
        ) : (
          <>
            <Icon name="image" size={32} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>
              {label}
            </Text>
          </>
        )}
      </Pressable>
      {photo && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ fontFamily: fonts.medium, fontSize: 13 }}>
            {label}
          </Text>
          <Pressable
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={"Remove " + label}
            onPress={onRemove}
            style={{
              width: 44,
              height: 44,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Icon name="x" size={18} />
          </Pressable>
        </View>
      )}
    </View>
  );
}
