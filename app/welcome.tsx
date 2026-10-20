import React from "react";
import { View, useWindowDimensions, ScrollView, Text } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Body,
  Button,
  Figure,
  Heading,
  Logo,
  StickerBadge,
} from "../src/components/ui";
import { colors as c, fonts, gradients, shadow } from "../src/theme";
import { analytics } from "../src/lib/analytics";

export default function Welcome() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const w = Math.min(width, 480);
  const collageHeight = Math.max(
    410,
    height - 380 - insets.top - insets.bottom,
  );
  return (
    <LinearGradient colors={gradients.yellow} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ minHeight: height, paddingTop: insets.top }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: collageHeight }}>
          <View
            style={{
              position: "absolute",
              left: 24,
              top: 28,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Logo />
            <Heading size={19}>Outfit League</Heading>
          </View>
          {(
            [
              {
                left: 0.067,
                top: 100,
                width: 0.385,
                height: 204,
                rotate: "-8deg",
                palette: "lavender",
                image: "navy",
              },
              {
                left: 0.503,
                top: 86,
                width: 0.41,
                height: 214,
                rotate: "7deg",
                palette: "coral",
                image: "ivory",
              },
              {
                left: 0.287,
                top: 168,
                width: 0.436,
                height: 232,
                rotate: "-2deg",
                palette: "mint",
                image: "green",
              },
            ] as const
          ).map((item) => (
            <View
              key={item.image}
              style={{
                position: "absolute",
                left: w * item.left,
                top: item.top,
                width: w * item.width,
                height: item.height,
                borderRadius: 28,
                transform: [{ rotate: item.rotate }],
                ...shadow(0.22),
              }}
            >
              <LinearGradient
                colors={gradients[item.palette]}
                style={{
                  flex: 1,
                  borderRadius: 28,
                  borderWidth: 4,
                  borderColor: c.white,
                  overflow: "hidden",
                }}
              >
                <Figure image={item.image} scale={0.94} />
              </LinearGradient>
            </View>
          ))}
          <StickerBadge
            size={17}
            rotate="-7deg"
            style={{ position: "absolute", left: 14, top: 340 }}
          >
            Try it on
          </StickerBadge>
          <StickerBadge
            size={17}
            color={c.white}
            rotate="6deg"
            style={{ position: "absolute", right: 12, top: 318 }}
          >
            Which fit wins?
          </StickerBadge>
        </View>
        <View
          style={{
            backgroundColor: c.cream,
            borderTopLeftRadius: 36,
            borderTopRightRadius: 36,
            minHeight: 380,
            flex: 1,
            padding: 24,
            paddingTop: 28,
            paddingBottom: Math.max(24, insets.bottom),
            gap: 12,
            ...shadow(0.18),
          }}
        >
          <Heading size={34} style={{ letterSpacing: -1.2 }}>
            {width <= 430
              ? "Find the fit. Try\nit on. Let the\nsquad vote."
              : "Find the fit. Try it on. Let the squad vote."}
          </Heading>
          <Body>
            Save your inspiration, preview outfits with AI, and let friends vote
            on your favorite looks.
          </Body>
          <View style={{ marginTop: "auto", gap: 10, paddingTop: 0 }}>
            <Button
              title="Explore sample looks"
              onPress={() => {
                analytics.track("onboarding_completed", { mode: "guest" });
                router.replace("/(tabs)");
              }}
            />
            <Button
              secondary
              title="Sign in or create account"
              onPress={() => router.push("/auth")}
            />
            <Text
              style={{
                textAlign: "center",
                fontFamily: fonts.body,
                fontSize: 12,
                lineHeight: 17,
                color: c.text3,
              }}
            >
              Browse samples for free. Sign in for your private Closet, AI
              try-ons and battles.
            </Text>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
