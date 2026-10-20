import React from "react";
import { Text, View } from "react-native";
import { colors, fonts } from "../theme";

export function AvatarStack({
  initials = ["A", "B", "C"],
}: {
  initials?: string[];
}) {
  return (
    <View
      accessibilityLabel="Sample avatars"
      style={{ flexDirection: "row", paddingLeft: 10 }}
    >
      {initials.map((initial, index) => (
        <View
          key={initial + index}
          style={{
            marginLeft: -10,
            width: 44,
            height: 44,
            borderRadius: 22,
            borderWidth: 2,
            borderColor: colors.cream,
            backgroundColor: ["#B9ACFF", "#FF7A66", "#8EDDBC"][index % 3],
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontFamily: fonts.heading }}>{initial}</Text>
        </View>
      ))}
    </View>
  );
}
