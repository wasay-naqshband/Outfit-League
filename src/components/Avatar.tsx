import React from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import { Icon } from "./ui";
import { colors, fonts } from "../theme";

// Profile photo, or the first letter of the name on yellow when there is none.
export function Avatar({
  uri,
  name,
  size,
}: {
  uri?: string | null;
  name?: string;
  size: number;
}) {
  return uri ? (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      accessibilityLabel="Your profile photo"
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.yellow,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {name?.trim() ? (
        <Text
          style={{
            fontFamily: fonts.heading,
            fontSize: size * 0.42,
            color: colors.ink,
          }}
        >
          {name.trim().charAt(0).toUpperCase()}
        </Text>
      ) : (
        <Icon name="user" size={size * 0.45} />
      )}
    </View>
  );
}
