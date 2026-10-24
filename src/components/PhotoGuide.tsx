import React from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import { Body, Heading, Icon } from "./ui";
import { colors, fonts } from "../theme";

// The try-on photo instructions, shared by Your photo and onboarding.
const TIPS = [
  "Your whole body, head to toe, in the frame",
  "Stand straight, facing the camera, arms a little away from your body",
  "Plain wall or background, good even light",
  "Fitted clothes work best — avoid bulky coats",
  "Ask a friend or use the camera timer",
];

export function PhotoGuide() {
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderRadius: 22,
        padding: 18,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", gap: 14 }}>
        <View style={{ width: 104, gap: 6 }}>
          <Image
            source={require("../../assets/examples/full-body-photo.jpg")}
            contentFit="cover"
            accessibilityLabel="Example: a full-body photo, head to toe, face visible"
            style={{ width: 104, height: 226, borderRadius: 16 }}
          />
          <Text
            style={{
              alignSelf: "center",
              fontFamily: fonts.bold,
              fontSize: 12,
              color: "#127A55",
            }}
          >
            ✓ Like this
          </Text>
        </View>
        <View style={{ flex: 1, gap: 10, justifyContent: "center" }}>
          <Heading size={19}>Upload a full-body photo</Heading>
          <Body style={{ fontSize: 14 }}>
            Head to toe, standing, with your face clearly visible.
          </Body>
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              alignItems: "flex-start",
              backgroundColor: "#FFE4E4",
              borderRadius: 12,
              padding: 10,
            }}
          >
            <Icon name="x" size={16} color="#B42318" />
            <Body style={{ flex: 1, fontSize: 13, color: "#7A1A12" }}>
              No selfies or mirror pics where the phone covers your face.
            </Body>
          </View>
        </View>
      </View>
      <Heading size={18} style={{ marginTop: 4 }}>
        For the best results
      </Heading>
      {TIPS.map((tip) => (
        <View
          key={tip}
          style={{
            flexDirection: "row",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <Icon name="check" size={18} />
          <Body style={{ flex: 1, fontSize: 15 }}>{tip}</Body>
        </View>
      ))}
    </View>
  );
}
