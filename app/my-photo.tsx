import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useQueryClient } from "@tanstack/react-query";
import {
  Body,
  Button,
  CreditPill,
  Heading,
  Icon,
  type IconName,
  Page,
  RoundButton,
  StickerBadge,
} from "../src/components/ui";
import { Sheet } from "../src/components/AiLooks";
import { TactileButton, useReduceMotion } from "../src/components/ScanHero";
import { useApp } from "../src/lib/state";
import { useSavedPhoto } from "../src/lib/queries";
import { useTryOnDraft } from "../src/lib/tryon-draft";
import { pickPhoto } from "../src/lib/photos";
import { removeSavedPhoto, saveSavedPhoto } from "../src/lib/saved-photo";
import { colors, fonts, gradients, shadow } from "../src/theme";

const TIPS: [IconName, string, string, string][] = [
  ["user", "#E6E1FF", "Whole body", ", head to toe, in the frame"],
  [
    "user",
    "#DDF8EC",
    "Stand straight",
    ", facing the camera, arms slightly out",
  ],
  ["zap", "#FFF1C2", "Plain background", ", good even light"],
  ["shirt", "#FFD2C8", "Fitted clothes", " work best. Skip bulky coats"],
  ["clock", "#F1EEE4", "Ask a friend", " or use the camera timer"],
];

// Mirror selfie with the phone over the face, drawn with plain views.
function BadExample() {
  return (
    <View
      accessible
      accessibilityLabel="Example to avoid: mirror selfie with phone covering face"
      style={{ width: 130, height: 176, alignSelf: "center" }}
    >
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: 130,
          height: 66,
          borderTopLeftRadius: 65,
          borderTopRightRadius: 65,
          backgroundColor: "#2B3A8C",
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 56,
          top: 100,
          width: 18,
          height: 30,
          borderRadius: 8,
          backgroundColor: "#D9A67F",
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 33,
          top: 36,
          width: 64,
          height: 70,
          borderRadius: 32,
          backgroundColor: "#F1C7A3",
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 31,
          top: 26,
          width: 68,
          height: 38,
          borderTopLeftRadius: 34,
          borderTopRightRadius: 34,
          borderBottomLeftRadius: 14,
          borderBottomRightRadius: 14,
          backgroundColor: "#2A1B16",
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 46,
          top: 52,
          width: 38,
          height: 62,
          borderRadius: 8,
          backgroundColor: colors.ink,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 74,
          top: 60,
          width: 5,
          height: 5,
          borderRadius: 3,
          backgroundColor: "#4A4466",
        }}
      />
    </View>
  );
}

function Example({
  good,
  children,
}: {
  good: boolean;
  children: React.ReactNode;
}) {
  const ring = good ? "#127A55" : "#D63B24";
  return (
    <View style={{ flex: 1, gap: 8 }}>
      <View
        style={{
          height: 220,
          borderRadius: 24,
          borderWidth: 4,
          borderColor: colors.white,
          overflow: "hidden",
          backgroundColor: good ? "#DDF5E8" : "#FFD9CF",
          justifyContent: "flex-end",
          ...shadow(0.1),
          outlineWidth: 2.5,
          outlineColor: ring,
        }}
      >
        {children}
        <View
          style={{
            position: "absolute",
            left: 8,
            top: 8,
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: ring,
            borderWidth: 3,
            borderColor: colors.white,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={good ? "check" : "x"} size={14} color={colors.white} />
        </View>
      </View>
      <Text
        style={{
          fontFamily: fonts.bold,
          fontSize: 14,
          color: good ? "#0E6B45" : "#A3321F",
        }}
      >
        {good ? "Like this" : "Not this"}
      </Text>
      <Text
        style={{
          fontFamily: fonts.body,
          fontSize: 12,
          lineHeight: 16,
          color: "#4B475A",
          marginTop: -4,
        }}
      >
        {good
          ? "Head to toe, standing, face clearly visible."
          : "No selfies or mirror pics where the phone covers your face."}
      </Text>
    </View>
  );
}

export default function MyPhoto() {
  const { session } = useApp();
  const saved = useSavedPhoto();
  const draft = useTryOnDraft();
  const client = useQueryClient();
  const reduce = useReduceMotion();
  const width = useWindowDimensions().width;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const retry = useRef(false);
  const photo = saved.data;
  const cardW = Math.min(width - 72, 340);
  const cardH = Math.round((cardW * 392) / 318);

  const pop = useRef(new Animated.Value(reduce ? 1 : 0.6)).current;
  useEffect(() => {
    if (!photo || reduce) return;
    pop.setValue(0.6);
    Animated.sequence([
      Animated.timing(pop, {
        toValue: 1.08,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(pop, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [!!photo, reduce, pop]); // eslint-disable-line react-hooks/exhaustive-deps

  async function choose(camera: boolean) {
    if (!session || busy) return;
    retry.current = camera;
    setError("");
    try {
      const file = await pickPhoto(camera);
      if (!file) return;
      setPicked(file.uri);
      setBusy(true);
      await saveSavedPhoto(session.user.id, file);
      // Refetch the stored copy: the picked file is temporary and gets deleted.
      await client.invalidateQueries({
        queryKey: ["saved-photo", session.user.id],
      });
      draft.setPerson(file);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
      setPicked(null);
    }
  }
  async function remove() {
    if (!session || busy) return;
    setBusy(true);
    setDeleteError("");
    try {
      await removeSavedPhoto(session.user.id);
      client.setQueryData(["saved-photo", session.user.id], null);
      draft.setPerson(null);
      setConfirming(false);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const shown = picked ?? photo?.uri;
  return (
    <Page>
      <LinearGradient
        colors={gradients.yellow}
        style={{
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
          paddingTop: 28,
          paddingHorizontal: 20,
          paddingBottom: 22,
          gap: 14,
          ...shadow(0.1),
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <RoundButton
            name="arrow-left"
            label="Back"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/(tabs)")
            }
          />
          <Heading size={28} style={{ flex: 1, letterSpacing: -0.9 }}>
            Your photo
          </Heading>
          <CreditPill />
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <Heading size={30} style={{ letterSpacing: -1 }}>
            You, in every
          </Heading>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <StickerBadge size={24}>fit.</StickerBadge>
          </View>
        </View>
      </LinearGradient>

      <View style={{ padding: 20, gap: 16 }}>
        <View style={{ height: cardH + 40, marginTop: 4 }}>
          <View
            style={{
              position: "absolute",
              top: 22,
              alignSelf: "center",
              width: cardW,
              height: cardH,
              transform: [{ rotate: "-2deg" }],
              borderRadius: 30,
              borderWidth: shown ? 6 : 0,
              borderColor: colors.white,
              overflow: "hidden",
              backgroundColor: shown ? "#2A2640" : "transparent",
              ...(shown ? shadow(0.25) : {}),
            }}
          >
            {shown ? (
              <>
                <Image
                  source={{ uri: shown }}
                  cachePolicy={picked ? "none" : undefined}
                  contentFit="cover"
                  contentPosition="top"
                  transition={reduce ? 0 : 250}
                  style={{ flex: 1, opacity: picked ? 0.45 : 1 }}
                  accessibilityLabel="Your try-on photo"
                />
                <LinearGradient
                  pointerEvents="none"
                  colors={["rgba(20,18,31,0)", "rgba(20,18,31,0.55)"]}
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: "38%",
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    left: 12,
                    top: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    backgroundColor: "rgba(255,255,255,0.94)",
                    borderRadius: 999,
                    paddingVertical: 5,
                    paddingHorizontal: 10,
                  }}
                >
                  <Icon name="lock" size={12} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12 }}>
                    Private
                  </Text>
                </View>
                {picked ? (
                  <View
                    accessibilityLiveRegion="polite"
                    style={{
                      ...({ position: "absolute", inset: 0 } as object),
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                    }}
                  >
                    <ActivityIndicator size="large" color={colors.ink} />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 15 }}>
                      Saving your photo…
                    </Text>
                  </View>
                ) : (
                  <View
                    style={{
                      position: "absolute",
                      left: 12,
                      bottom: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      backgroundColor: colors.ink,
                      borderRadius: 999,
                      paddingVertical: 7,
                      paddingHorizontal: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        backgroundColor: "#5CE08F",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon name="check" size={11} />
                    </View>
                    <Text
                      style={{
                        fontFamily: fonts.bold,
                        fontSize: 13,
                        color: colors.white,
                      }}
                    >
                      Used for every try-on
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View
                style={{
                  flex: 1,
                  borderRadius: 30,
                  borderWidth: 2.5,
                  borderStyle: "dashed",
                  borderColor: "rgba(20,18,31,0.3)",
                  backgroundColor: "rgba(255,255,255,0.6)",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  padding: 24,
                }}
              >
                <Icon name="user" size={96} color="rgba(20,18,31,0.25)" />
                <Heading size={22} style={{ textAlign: "center" }}>
                  Add a full-body photo
                </Heading>
                <Body style={{ textAlign: "center" }}>
                  One photo powers every try-on.
                </Body>
              </View>
            )}
          </View>
          {!!photo && !picked && (
            <Animated.View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                position: "absolute",
                right: 20,
                top: 6,
                transform: [{ scale: pop }],
              }}
            >
              <StickerBadge size={15} color={colors.yellow} rotate="3deg">
                Looking sharp
              </StickerBadge>
            </Animated.View>
          )}
        </View>

        {!session ? (
          <Button
            title="Sign in to save your photo"
            onPress={() => router.push("/auth")}
          />
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: 12 }}>
              {Platform.OS !== "web" && (
                <TactileButton
                  icon="camera"
                  title={photo ? "Take a new photo" : "Take a photo"}
                  disabled={busy}
                  style={{ flex: 1 }}
                  onPress={() => void choose(true)}
                />
              )}
              <TactileButton
                icon="image"
                label="Choose from gallery"
                title={
                  Platform.OS === "web" ? "Choose from gallery" : undefined
                }
                fill={colors.white}
                disabled={busy}
                style={Platform.OS === "web" ? { flex: 1 } : { width: 64 }}
                onPress={() => void choose(false)}
              />
            </View>
            {!!error && (
              <View
                accessibilityLiveRegion="polite"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: "#FFE7E1",
                  borderRadius: 18,
                  padding: 14,
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    fontFamily: fonts.medium,
                    fontSize: 14,
                    color: "#5C1D12",
                  }}
                >
                  Couldn’t save your photo. Try again.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void choose(retry.current)}
                  style={{
                    minHeight: 44,
                    justifyContent: "center",
                    paddingHorizontal: 14,
                    borderRadius: 14,
                    backgroundColor: colors.ink,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.bold,
                      fontSize: 14,
                      color: colors.white,
                    }}
                  >
                    Retry
                  </Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 18,
            backgroundColor: colors.white,
            ...shadow(0.05),
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              backgroundColor: "#E6E1FF",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="shield" size={16} />
          </View>
          <Text
            style={{
              flex: 1,
              fontFamily: fonts.body,
              fontSize: 14,
              lineHeight: 19,
              color: "#3B3647",
            }}
          >
            Kept privately in your account, even if you delete it from your
            camera roll.
          </Text>
        </View>

        <Heading size={22} style={{ marginTop: 14, letterSpacing: -0.6 }}>
          What makes a great photo
        </Heading>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Example good>
            <Image
              source={require("../assets/examples/good-example-full-body.jpg")}
              contentFit="contain"
              accessibilityLabel="Example: full-body photo, standing, face visible"
              style={{ flex: 1 }}
            />
          </Example>
          <Example good={false}>
            <View
              style={{
                ...({
                  position: "absolute",
                  left: 14,
                  right: 14,
                  top: 12,
                  bottom: -10,
                } as object),
                borderWidth: 5,
                borderBottomWidth: 0,
                borderColor: "#B7A68A",
                borderTopLeftRadius: 60,
                borderTopRightRadius: 60,
                backgroundColor: "rgba(255,255,255,0.35)",
              }}
            />
            <BadExample />
          </Example>
        </View>

        <View
          style={{
            backgroundColor: colors.white,
            borderRadius: 24,
            paddingHorizontal: 16,
            paddingVertical: 4,
            marginTop: 6,
            ...shadow(0.06),
          }}
        >
          {TIPS.map(([icon, tint, lead, rest], i) => (
            <View
              key={lead}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                minHeight: 58,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: "#F0ECE0",
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 11,
                  backgroundColor: tint,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={icon} size={18} />
              </View>
              <Text
                style={{
                  flex: 1,
                  fontFamily: fonts.body,
                  fontSize: 14,
                  lineHeight: 19,
                  color: colors.ink,
                }}
              >
                <Text style={{ fontFamily: fonts.bold }}>{lead}</Text>
                {rest}
              </Text>
            </View>
          ))}
        </View>

        {!!photo && !!session && (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => {
              setDeleteError("");
              setConfirming(true);
            }}
            style={({ pressed }) => ({
              alignSelf: "center",
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 16,
              marginTop: 6,
              marginBottom: 20,
              opacity: pressed || busy ? 0.6 : 1,
            })}
          >
            <Icon name="trash-2" size={18} color="#B3301C" />
            <Text
              style={{ fontFamily: fonts.bold, fontSize: 15, color: "#B3301C" }}
            >
              Delete saved photo
            </Text>
          </Pressable>
        )}
      </View>

      <Sheet visible={confirming} onClose={() => !busy && setConfirming(false)}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              width: 72,
              height: 88,
              borderRadius: 18,
              borderWidth: 3,
              borderColor: colors.white,
              overflow: "hidden",
              backgroundColor: "#DCD5FF",
              transform: [{ rotate: "-4deg" }],
              ...shadow(0.15),
            }}
          >
            {!!photo && (
              <Image
                source={{ uri: photo.uri }}
                contentFit="cover"
                contentPosition="top"
                style={{ flex: 1 }}
              />
            )}
          </View>
          <Heading size={24} style={{ flex: 1 }}>
            Delete your try-on photo?
          </Heading>
        </View>
        <View
          style={{
            flexDirection: "row",
            gap: 10,
            backgroundColor: "#FFE7E1",
            borderRadius: 18,
            paddingVertical: 12,
            paddingHorizontal: 14,
          }}
        >
          <Icon name="alert-triangle" size={20} color="#A3321F" />
          <Text
            style={{
              flex: 1,
              fontFamily: fonts.body,
              fontSize: 14,
              color: "#5C1D12",
            }}
          >
            You’ll need to add a new photo before your next try-on. Your past
            looks stay saved.
          </Text>
        </View>
        {!!deleteError && (
          <Text
            accessibilityLiveRegion="polite"
            style={{ fontFamily: fonts.medium, fontSize: 14, color: "#A3321F" }}
          >
            {deleteError}
          </Text>
        )}
        <View
          style={{ height: 62, borderRadius: 20, backgroundColor: colors.ink }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete photo"
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            onPress={() => void remove()}
            style={({ pressed }) => ({
              height: 58,
              marginTop: pressed ? 4 : 0,
              borderRadius: 20,
              borderWidth: 2.5,
              borderColor: colors.ink,
              backgroundColor: "#D63B24",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            })}
          >
            {busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Icon name="trash-2" size={20} color={colors.white} />
            )}
            <Text
              style={{
                fontFamily: fonts.bold,
                fontSize: 17,
                color: colors.white,
              }}
            >
              Delete photo
            </Text>
          </Pressable>
        </View>
        <TactileButton
          title="Keep it"
          fill={colors.white}
          disabled={busy}
          onPress={() => setConfirming(false)}
        />
      </Sheet>
    </Page>
  );
}
