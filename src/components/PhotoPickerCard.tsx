import React from "react";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
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
  const person = label === "Your photo";
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Pressable
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${photo ? "Change" : "Add"} ${label}`}
        onPress={onChoose}
        style={{
          height: 244,
          borderRadius: 28,
          borderWidth: 4,
          borderColor: colors.white,
          overflow: "hidden",
          ...shadow(0.12),
        }}
      >
        <LinearGradient
          colors={person ? ["#E6E1FF", "#C9BEFF"] : ["#DDF8EC", "#A9E6CC"]}
          style={{ flex: 1, padding: 16, alignItems: "center" }}
        >
          {photo && (
            <Image
              source={{ uri: photo.uri }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
              contentFit="cover"
              cachePolicy="memory"
              accessibilityLabel={
                person ? "Your selected photo" : "Selected clothing item"
              }
            />
          )}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              right: 8,
              bottom: 8,
              borderRadius: 20,
              borderWidth: 2,
              borderStyle: "dashed",
              borderColor: "rgba(20,18,31,0.22)",
            }}
          />
          <View
            style={{
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: colors.ink,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: colors.yellow,
                  fontFamily: fonts.bold,
                  fontSize: 13,
                }}
              >
                {person ? "1" : "2"}
              </Text>
            </View>
            <Text
              style={{
                color: colors.ink,
                fontFamily: fonts.bold,
                fontSize: 16,
              }}
            >
              {person ? "You" : "The fit"}
            </Text>
          </View>
          {!photo ? (
            <View
              pointerEvents="none"
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={person ? "user" : "hanger"} size={68} />
            </View>
          ) : null}
          <View
            pointerEvents="none"
            style={{
              minHeight: 44,
              alignSelf: "stretch",
              borderRadius: 14,
              backgroundColor: photo ? "rgba(255,255,255,0.96)" : colors.ink,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 7,
              marginTop: "auto",
            }}
          >
            <Icon
              name={photo ? "refresh-cw" : "plus"}
              size={18}
              color={photo ? colors.ink : colors.yellow}
            />
            <Text
              style={{
                color: photo ? colors.ink : colors.white,
                fontFamily: fonts.bold,
                fontSize: 14,
              }}
            >
              {photo ? "Change" : person ? "Add your photo" : "Add an item"}
            </Text>
          </View>
        </LinearGradient>
      </Pressable>
      {photo && (
        <Pressable
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label}`}
          onPress={onRemove}
          hitSlop={8}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.white,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="x" size={16} />
        </Pressable>
      )}
    </View>
  );
}
