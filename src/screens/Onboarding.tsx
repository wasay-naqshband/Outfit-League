import React, { useEffect, useState } from "react";
import { analytics } from "../lib/analytics";
import {
  AccessibilityInfo,
  Alert,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Body,
  Button,
  Figure,
  Heading,
  Icon,
  Logo,
  RoundButton,
  StickerBadge,
} from "../components/ui";
import { colors, fonts, gradients, shadow } from "../theme";
import { STYLE_OPTIONS, styleLabel, useOnboarding } from "../lib/onboarding";
import { disposePhoto, pickPhoto } from "../lib/photos";
import { PhotoGuide } from "../components/PhotoGuide";
import { saveSavedPhoto } from "../lib/saved-photo";
import { useTryOnDraft } from "../lib/tryon-draft";
import { useApp } from "../lib/state";
import type { LocalPhoto } from "../types/tryon";

// Copy and option ids follow the design handoff (onboarding-content.json).
const FREQUENCY = [
  ["almost_always", "Almost every time"],
  ["often", "More often than I'd like"],
  ["sometimes", "Now and then"],
  ["never", "Never. I'm just lucky"],
] as const;
const PAINS = [
  [
    "model_looked_better",
    "It looked better on the model",
    "Looked better on the model",
  ],
  ["colour_off", "The colour is off in real life", "Colour is off"],
  [
    "doesnt_match_wardrobe",
    "It doesn't go with anything I own",
    "Doesn't go with my stuff",
  ],
  [
    "returns_headache",
    "Returns are a total headache",
    "Returns are a headache",
  ],
  ["cod_stuck", "Paid cash on delivery, stuck with it", "Stuck with COD buys"],
  [
    "friends_unhelpful",
    'Friends say "it\'s fine" and mean "no"',
    "Friends aren't honest",
  ],
] as const;
const COSTS = [
  ["under_10k", "Under", "PKR 10k", "up to PKR 10k"],
  ["10k_25k", "Around", "PKR 10–25k", "PKR 10–25k"],
  ["25k_50k", "Around", "PKR 25–50k", "PKR 25–50k"],
  ["50k_plus", "Honestly", "PKR 50k+", "PKR 50k+"],
] as const;
const CHAT = [
  ["A", "both are cute", gradients.lavender[1]],
  ["M", "idk the first one?", gradients.coral[1]],
  ["S", "wait which is first", gradients.mint[1]],
] as const;
const PROGRESS = [0, 0.12, 0.25, 0.37, 0.5, 0.62, 0.75, 0.87];
const BUILDING = 8;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
  }, []);
  return reduced;
}
// Counts 0 → n, one tick every `ms`; jumps to n when Reduce Motion is on.
function useTicker(n: number, ms: number) {
  const reduced = useReducedMotion();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (reduced) return setCount(n);
    setCount(0);
    const timer = setInterval(
      () =>
        setCount((c) => {
          if (c + 1 >= n) clearInterval(timer);
          return Math.min(n, c + 1);
        }),
      ms,
    );
    return () => clearInterval(timer);
  }, [n, ms, reduced]);
  return count;
}

function Check({ on, square }: { on: boolean; square?: boolean }) {
  return (
    <View
      style={{
        width: 28,
        height: 28,
        borderRadius: square ? 7 : 14,
        backgroundColor: on ? colors.yellow : "transparent",
        borderWidth: on ? 0 : 2,
        borderColor: "#CFCAD9",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {on && <Icon name="check" size={16} />}
    </View>
  );
}
function Option({
  label,
  selected,
  multi,
  onPress,
}: {
  label: string;
  selected: boolean;
  multi?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={multi ? "checkbox" : "radio"}
      accessibilityState={multi ? { checked: selected } : { selected }}
      onPress={onPress}
      style={{
        minHeight: multi ? 58 : 64,
        borderRadius: multi ? 18 : 20,
        paddingHorizontal: 18,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        backgroundColor: selected ? colors.ink : colors.white,
        ...shadow(0.05),
      }}
    >
      {multi && <Check on={selected} square />}
      <Text
        style={{
          flex: 1,
          fontFamily: selected ? fonts.bold : fonts.medium,
          fontSize: multi ? 16 : 17,
          color: selected ? colors.white : colors.ink,
        }}
      >
        {label}
      </Text>
      {!multi && selected && <Check on />}
    </Pressable>
  );
}
function Card({
  tint,
  children,
  style,
}: {
  tint: readonly [string, string, ...string[]];
  children?: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[{ borderRadius: 28, ...shadow(0.12) }, style]}>
      <LinearGradient
        colors={tint}
        style={{
          flex: 1,
          borderRadius: 28,
          borderWidth: 4,
          borderColor: colors.white,
          overflow: "hidden",
        }}
      >
        {children}
      </LinearGradient>
    </View>
  );
}
function Tag({ children, dark }: { children: string; dark?: boolean }) {
  return (
    <Text
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        overflow: "hidden",
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 5,
        backgroundColor: dark ? colors.ink : colors.white,
        color: dark ? colors.white : colors.ink,
        fontFamily: fonts.bold,
        fontSize: 13,
      }}
    >
      {children}
    </Text>
  );
}

// Style tiles, shared with Settings → Your style.
export function StyleGrid({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {STYLE_OPTIONS.map((style) => {
        const on = selected.includes(style.id);
        return (
          <Pressable
            key={style.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={style.label}
            onPress={() => onToggle(style.id)}
            style={{ width: "31.5%", aspectRatio: 0.72 }}
          >
            <Card
              tint={style.tint}
              style={{
                flex: 1,
                borderWidth: on ? 3 : 0,
                borderColor: colors.ink,
                borderRadius: 31,
              }}
            >
              <Figure image={style.art} scale={1} bottom={30} />
              {on && (
                <View style={{ position: "absolute", top: 8, right: 8 }}>
                  <Check on />
                </View>
              )}
              <Text
                style={{
                  position: "absolute",
                  left: 6,
                  right: 6,
                  bottom: 6,
                  overflow: "hidden",
                  textAlign: "center",
                  paddingVertical: 7,
                  borderRadius: 14,
                  backgroundColor: on ? colors.ink : colors.white,
                  color: on ? colors.white : colors.ink,
                  fontFamily: fonts.bold,
                  fontSize: 15,
                }}
              >
                {style.label}
              </Text>
            </Card>
          </Pressable>
        );
      })}
    </View>
  );
}
export const toggle = (list: string[], id: string) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { session } = useApp();
  const draft = useTryOnDraft();
  const client = useQueryClient();
  const { answers, update } = useOnboarding();
  const step = answers.step;
  const [busy, setBusy] = useState(false);
  const [showPhotoGuide, setShowPhotoGuide] = useState(false);
  const [chosenPhoto, setChosenPhoto] = useState<LocalPhoto | null>(null);
  const go = (next: number) => update({ step: next });
  // Funnel: which onboarding screen people reach (once each per session).
  useEffect(() => {
    analytics.track(
      "onboarding_step",
      { step: String(step + 1) as "1" },
      "onboarding:" + step,
    );
  }, [step]);
  const back = () => {
    if (showPhotoGuide) {
      setShowPhotoGuide(false);
      setChosenPhoto(null);
      void disposePhoto(chosenPhoto);
    } else if (step > 0 && step < BUILDING) go(step - 1);
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      back();
      return showPhotoGuide || step > 0;
    });
    return () => sub.remove();
  }, [step, showPhotoGuide, chosenPhoto]);

  async function choosePhoto(camera: boolean) {
    setBusy(true);
    try {
      const photo = await pickPhoto(camera);
      if (!photo) return;
      void disposePhoto(chosenPhoto);
      setChosenPhoto(photo);
    } catch (e) {
      Alert.alert(
        "That photo didn’t work",
        e instanceof Error ? e.message : "Please try another photo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmPhoto() {
    if (!chosenPhoto) return;
    setBusy(true);
    try {
      if (session) {
        await saveSavedPhoto(session.user.id, chosenPhoto);
        await client.invalidateQueries({ queryKey: ["saved-photo"] });
      }
      draft.setPerson(chosenPhoto);
      setChosenPhoto(null);
      setShowPhotoGuide(false);
      update({ step: BUILDING, tryOnPhotoAdded: true });
    } catch (e) {
      Alert.alert(
        "That photo didn’t work",
        e instanceof Error ? e.message : "Please try another photo.",
      );
    } finally {
      setBusy(false);
    }
  }

  const cost = COSTS.find(([id]) => id === answers.yearlyWaste);
  // Ring + checklist on the building step: 0 → 100 in about 3.5 s.
  const percent = useTicker(step === BUILDING ? 100 : 0, 35);
  const chat = useTicker(step === 4 ? 6 : 0, 400);

  if (step === 7 && showPhotoGuide)
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream }}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 180,
            gap: 18,
          }}
          showsVerticalScrollIndicator={false}
        >
          <RoundButton
            name="arrow-left"
            label="Back to photo step"
            onPress={back}
          />
          <Heading size={30}>
            {chosenPhoto
              ? "Check your photo."
              : "Make your try-on look like you."}
          </Heading>
          <Body>
            {chosenPhoto
              ? "Can you see your entire body clearly? If anything is cut off or blurry, choose another photo."
              : "Take a moment to get this right. A clear photo helps us make a more accurate preview; a cropped or blurry one can look wrong."}
          </Body>
          {chosenPhoto ? (
            <>
              <View
                style={{
                  backgroundColor: colors.white,
                  borderRadius: 26,
                  padding: 14,
                  gap: 10,
                  ...shadow(0.06),
                }}
              >
                <Image
                  source={
                    chosenPhoto
                      ? { uri: chosenPhoto.uri }
                      : require("../../assets/illustrations/good-tryon-photo.png")
                  }
                  contentFit="contain"
                  style={{
                    height: 220,
                    backgroundColor: "#F4F0E6",
                    borderRadius: 18,
                  }}
                  accessibilityLabel={
                    chosenPhoto
                      ? "Your selected try-on photo"
                      : "Example: one person standing front facing, fully visible from head to shoes, in bright even light"
                  }
                />
                <Text
                  style={{
                    fontFamily: fonts.bold,
                    fontSize: 15,
                    textAlign: "center",
                  }}
                >
                  {chosenPhoto
                    ? "Your selected photo"
                    : "Example of a good try-on photo"}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: colors.white,
                  borderRadius: 24,
                  padding: 18,
                  gap: 12,
                }}
              >
                {[
                  "Keep your head and shoes fully in frame, with space around you.",
                  "Face the camera with arms clear of your body. Use a timer or ask a friend.",
                  "Use bright, even light and a simple background. Avoid blur and filters.",
                ].map((tip) => (
                  <View
                    key={tip}
                    style={{
                      flexDirection: "row",
                      gap: 10,
                      alignItems: "flex-start",
                    }}
                  >
                    <Icon name="check" size={18} color="#127A55" />
                    <Body style={{ flex: 1, fontSize: 15 }}>{tip}</Body>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <PhotoGuide />
          )}
        </ScrollView>
        <View
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            bottom: insets.bottom + 16,
            gap: 10,
            backgroundColor: colors.cream,
          }}
        >
          {chosenPhoto ? (
            <>
              <Button
                title={busy ? "Saving your photo…" : "Use this photo"}
                disabled={busy}
                onPress={() => void confirmPhoto()}
              />
              <Button
                title="Choose another"
                secondary
                disabled={busy}
                onPress={() => void choosePhoto(false)}
              />
            </>
          ) : (
            <>
              {Platform.OS !== "web" && (
                <Button
                  title="Take a photo"
                  icon="camera"
                  disabled={busy}
                  onPress={() => void choosePhoto(true)}
                />
              )}
              <Button
                title="Choose from library"
                icon="image"
                secondary={Platform.OS !== "web"}
                disabled={busy}
                onPress={() => void choosePhoto(false)}
              />
            </>
          )}
        </View>
      </View>
    );

  if (step === 0)
    return (
      <LinearGradient colors={gradients.yellow} style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingTop: insets.top + 20 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingHorizontal: 24,
            }}
          >
            <Logo />
            <Heading size={21}>Outfit League</Heading>
          </View>
          <View style={{ flex: 1, minHeight: 300 }}>
            <Card
              tint={gradients.lavender}
              style={{
                position: "absolute",
                left: "5%",
                top: "12%",
                width: "44%",
                height: 230,
                transform: [{ rotate: "-6deg" }],
              }}
            >
              <Figure image="navy" scale={0.95} bottom={-4} />
              <Tag>Online</Tag>
            </Card>
            <StickerBadge
              style={{ position: "absolute", left: "6%", top: "60%" }}
              size={17}
            >
              Looks fire
            </StickerBadge>
            <Card
              tint={["#ECE7DD", "#D2CCBF"]}
              style={{
                position: "absolute",
                right: "4%",
                top: "18%",
                width: "44%",
                height: 230,
                transform: [{ rotate: "5deg" }],
              }}
            >
              <Figure image="navy" scale={0.95} bottom={-4} />
              <Tag dark>In person</Tag>
            </Card>
            <StickerBadge
              color={colors.white}
              rotate="5deg"
              style={{ position: "absolute", right: "5%", top: "66%" }}
              size={17}
            >
              ...wait, what?
            </StickerBadge>
          </View>
          <View
            style={{
              backgroundColor: colors.cream,
              borderTopLeftRadius: 36,
              borderTopRightRadius: 36,
              padding: 24,
              paddingBottom: insets.bottom + 20,
              gap: 14,
            }}
          >
            <Heading size={38} style={{ letterSpacing: -1.4 }}>
              Bought it online. Hated it in person.
            </Heading>
            <Body style={{ fontSize: 17, lineHeight: 24 }}>
              You're not bad at shopping. You just never get to see it on you
              before you pay.
            </Body>
            <Button
              title="That's me. Fix it."
              style={{ minHeight: 60, borderRadius: 22, marginTop: 18 }}
              onPress={() => go(1)}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/auth")}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Body style={{ textAlign: "center" }}>
                I already have an account
              </Body>
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    );

  if (step === BUILDING) {
    const styles = answers.styles.slice(0, 2).map(styleLabel).join(" + ");
    const told = PAINS.filter(([id]) => answers.painPoints.includes(id))
      .slice(0, 3)
      .map(([, , chip]): string => chip);
    if (told.length < 3) told.unshift("Looks different every time");
    const lines = [
      `Matching fits to ${styles || "your style"}`,
      "Finding similar lookalikes",
      "Setting up your AI try-ons",
    ];
    // ponytail: quarter-step ring from borders; use react-native-svg for a smooth arc.
    const quarter = (from: number) =>
      percent > from ? colors.ink : "rgba(20,18,31,0.12)";
    return (
      <LinearGradient colors={gradients.yellow} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            padding: 20,
            paddingTop: insets.top + 40,
            paddingBottom: insets.bottom + 120,
            gap: 22,
            alignItems: "center",
          }}
        >
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: percent }}
            style={{
              width: 150,
              height: 150,
              borderRadius: 75,
              borderWidth: 14,
              borderTopColor: quarter(0),
              borderRightColor: quarter(25),
              borderBottomColor: quarter(50),
              borderLeftColor: quarter(75),
              transform: [{ rotate: "45deg" }],
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.white,
            }}
          >
            <View style={{ transform: [{ rotate: "-45deg" }] }}>
              <Heading size={36}>{percent}%</Heading>
            </View>
          </View>
          <Heading size={30} style={{ textAlign: "center" }}>
            Building your fitting room...
          </Heading>
          <View
            style={{
              alignSelf: "stretch",
              backgroundColor: colors.white,
              borderRadius: 28,
              paddingHorizontal: 18,
            }}
          >
            {lines.map((line, i) => {
              const done = percent >= ((i + 1) * 100) / 3 - 1;
              return (
                <View
                  key={line}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    paddingVertical: 16,
                    borderTopWidth: i ? 1 : 0,
                    borderTopColor: "#F0ECE0",
                  }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: done ? "#127A55" : colors.cream,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {done && (
                      <Icon name="check" size={16} color={colors.white} />
                    )}
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: done ? fonts.medium : fonts.bold,
                      fontSize: 16,
                      color: colors.ink,
                    }}
                  >
                    {line}
                  </Text>
                </View>
              );
            })}
          </View>
          <Card tint={gradients.pink} style={{ alignSelf: "stretch" }}>
            <View style={{ padding: 20, gap: 12 }}>
              <Text
                style={{
                  fontFamily: fonts.bold,
                  fontSize: 12,
                  letterSpacing: 1.2,
                  color: colors.text2,
                }}
              >
                YOU TOLD US
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {told.map((chip) => (
                  <Text
                    key={chip}
                    style={{
                      overflow: "hidden",
                      backgroundColor: colors.white,
                      borderRadius: 16,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      fontFamily: fonts.bold,
                      fontSize: 13,
                      color: colors.ink,
                    }}
                  >
                    {chip}
                  </Text>
                ))}
              </View>
              <Heading size={23}>
                From now on, you'll see it on you before you pay.
              </Heading>
            </View>
          </Card>
        </ScrollView>
        <View
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            bottom: insets.bottom + 20,
          }}
        >
          <Button
            title="Start with 3 free try-ons"
            disabled={percent < 100}
            style={{ minHeight: 60, borderRadius: 22 }}
            onPress={() => {
              update({ done: true });
              router.replace("/(tabs)");
            }}
          />
        </View>
      </LinearGradient>
    );
  }

  const screens: Record<
    number,
    {
      title: string;
      subtitle: string;
      cta: string;
      ready?: boolean;
      next?: () => void;
      body: React.ReactNode;
      secondary?: React.ReactNode;
    }
  > = {
    1: {
      title: "How often does a fit look different once it's on you?",
      subtitle: "Be honest. Nobody's judging.",
      cta: "Continue",
      ready: !!answers.frequency,
      body: (
        <View style={{ gap: 10 }}>
          {FREQUENCY.map(([id, label]) => (
            <Option
              key={id}
              label={label}
              selected={answers.frequency === id}
              onPress={() => update({ frequency: id })}
            />
          ))}
          {["almost_always", "often"].includes(answers.frequency ?? "") && (
            <StickerBadge style={{ alignSelf: "flex-end", marginTop: 8 }}>
              Same, honestly
            </StickerBadge>
          )}
        </View>
      ),
    },
    2: {
      title: "What usually goes wrong?",
      subtitle: "Pick everything that stings.",
      cta: answers.painPoints.length
        ? `Continue · ${answers.painPoints.length} picked`
        : "Continue",
      ready: answers.painPoints.length > 0,
      body: (
        <View style={{ gap: 8 }}>
          {PAINS.map(([id, label]) => (
            <Option
              key={id}
              multi
              label={label}
              selected={answers.painPoints.includes(id)}
              onPress={() =>
                update({ painPoints: toggle(answers.painPoints, id) })
              }
            />
          ))}
        </View>
      ),
    },
    3: {
      title: "How much goes on clothes you barely wear?",
      subtitle: "A rough guess, per year.",
      cta: "Continue",
      ready: !!cost,
      body: (
        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {COSTS.map(([id, eyebrow, label]) => {
              const on = answers.yearlyWaste === id;
              return (
                <Pressable
                  key={id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  onPress={() => update({ yearlyWaste: id })}
                  style={{
                    width: "48.5%",
                    minHeight: 104,
                    borderRadius: 22,
                    padding: 18,
                    justifyContent: "center",
                    backgroundColor: on ? colors.ink : colors.white,
                    ...shadow(0.05),
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.medium,
                      fontSize: 15,
                      color: on ? "#D8D3E4" : colors.text2,
                    }}
                  >
                    {eyebrow}
                  </Text>
                  <Heading size={22} style={on && { color: colors.white }}>
                    {label}
                  </Heading>
                  {on && (
                    <View style={{ position: "absolute", top: 12, right: 12 }}>
                      <Check on />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
          {cost && (
            <View>
              <Card tint={["#FFD3EA", "#FF9BD2"]}>
                <View style={{ padding: 22, gap: 10 }}>
                  <Heading size={24}>
                    That's {cost[3]} a year spent on guessing.
                  </Heading>
                  <Body style={{ color: colors.ink }}>
                    Clothes in the cupboard with the tags still on. Let's make
                    the next one a sure thing.
                  </Body>
                </View>
              </Card>
              <StickerBadge
                color={colors.yellow}
                rotate="6deg"
                style={{ position: "absolute", right: 20, top: -14 }}
              >
                Ouch
              </StickerBadge>
            </View>
          )}
        </View>
      ),
    },
    4: {
      title: "And then there's the group chat.",
      subtitle: "Six mirror selfies later...",
      cta: "Painfully familiar",
      ready: true,
      body: (
        <View
          style={{
            backgroundColor: colors.white,
            borderRadius: 30,
            padding: 18,
            gap: 12,
            ...shadow(0.1),
          }}
        >
          {chat >= 1 && (
            <View
              style={{
                alignSelf: "flex-end",
                width: "64%",
                backgroundColor: colors.ink,
                borderRadius: 24,
                padding: 10,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row", gap: 8, height: 110 }}>
                <Card tint={gradients.lavender} style={{ flex: 1 }}>
                  <Figure image="navy" bottom={-4} />
                </Card>
                <Card tint={gradients.mint} style={{ flex: 1 }}>
                  <Figure image="green" bottom={-4} />
                </Card>
              </View>
              <Text
                style={{
                  color: colors.white,
                  fontFamily: fonts.medium,
                  fontSize: 15,
                  paddingHorizontal: 4,
                }}
              >
                Which one for Saturday??
              </Text>
            </View>
          )}
          {CHAT.slice(0, Math.max(0, chat - 1)).map(([who, text, tint]) => (
            <View
              key={who}
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: tint,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontFamily: fonts.bold, color: colors.ink }}>
                  {who}
                </Text>
              </View>
              <Text
                style={{
                  overflow: "hidden",
                  backgroundColor: "#F1EEE4",
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  fontFamily: fonts.body,
                  fontSize: 16,
                  color: colors.ink,
                }}
              >
                {text}
              </Text>
            </View>
          ))}
          {chat >= 5 && (
            <Text
              style={{
                alignSelf: "flex-end",
                overflow: "hidden",
                backgroundColor: colors.ink,
                color: colors.white,
                borderRadius: 20,
                paddingHorizontal: 18,
                paddingVertical: 8,
                fontFamily: fonts.bold,
              }}
            >
              ...
            </Text>
          )}
          {chat >= 5 && (
            <Body style={{ alignSelf: "flex-end", fontSize: 13 }}>
              Seen by 7 · no decision
            </Body>
          )}
          {chat >= 6 && (
            <StickerBadge
              style={{ position: "absolute", left: -8, top: 30 }}
              size={16}
            >
              Sound familiar?
            </StickerBadge>
          )}
        </View>
      ),
    },
    5: {
      title: "Meet your AI fitting room.",
      subtitle: "See any outfit on you before you spend a single rupee.",
      cta: "I need this",
      ready: true,
      body: (
        <View style={{ gap: 10, alignItems: "center" }}>
          <View
            style={{
              flexDirection: "row",
              gap: 12,
              height: 150,
              alignSelf: "stretch",
            }}
          >
            <Card tint={gradients.lavender} style={{ flex: 1 }}>
              <Figure image="ivory" scale={0.62} bottom={-6} />
              <Tag>Your photo</Tag>
            </Card>
            <Card tint={gradients.mint} style={{ flex: 1 }}>
              <Image
                source={require("../../assets/garments/navy.jpg")}
                contentFit="contain"
                style={{ flex: 1, margin: 26, borderRadius: 12 }}
              />
              <Tag>Any fit</Tag>
            </Card>
          </View>
          <View style={{ transform: [{ rotate: "-90deg" }] }}>
            <Icon name="arrow-left" size={26} />
          </View>
          <Card tint={gradients.coral} style={{ width: "62%", height: 240 }}>
            <Figure image="navy" scale={0.95} bottom={-6} />
            <Tag>✦ AI preview</Tag>
            <StickerBadge
              style={{ position: "absolute", right: 8, bottom: 26 }}
              size={17}
            >
              That's you
            </StickerBadge>
          </Card>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 8,
              marginTop: 8,
            }}
          >
            {(
              [
                ["sparkles", "Try it on"],
                ["zap", "Let friends vote"],
                ["shopping-bag", "Shop for less"],
              ] as const
            ).map(([icon, label]) => (
              <View
                key={label}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: colors.white,
                  borderRadius: 20,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                }}
              >
                <Icon name={icon} size={16} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 14 }}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ),
    },
    6: {
      title: "Pick your vibe.",
      subtitle:
        "We'll fill Explore with fits you'd actually wear. Pick two or more.",
      cta: answers.styles.length
        ? `Continue · ${answers.styles.length} picked`
        : "Continue",
      ready: answers.styles.length >= 2,
      body: (
        <View style={{ gap: 16 }}>
          <StyleGrid
            selected={answers.styles}
            onToggle={(id) => update({ styles: toggle(answers.styles, id) })}
          />
          <Body style={{ textAlign: "center", fontSize: 14 }}>
            You can change this anytime in Settings.
          </Body>
        </View>
      ),
    },
    7: {
      title: "Add your try-on photo.",
      subtitle: "One good photo. Every outfit, on you, from now on.",
      cta: busy ? "Getting your photo ready…" : "Add my photo",
      ready: !busy,
      next: () => setShowPhotoGuide(true),
      body: (
        <View style={{ gap: 14 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take or choose a photo"
            disabled={busy}
            onPress={() => setShowPhotoGuide(true)}
            style={{
              backgroundColor: "#DCD5FF",
              borderRadius: 30,
              borderWidth: 4,
              borderColor: colors.white,
              padding: 12,
              ...shadow(0.08),
            }}
          >
            <View
              style={{
                borderWidth: 2,
                borderStyle: "dashed",
                borderColor: "#A8A0C4",
                borderRadius: 22,
                paddingVertical: 44,
                alignItems: "center",
                gap: 10,
              }}
            >
              <Icon name="camera" size={34} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 18 }}>
                Take or choose a photo
              </Text>
              <Body>See an example and photo tips first</Body>
            </View>
          </Pressable>
          <PhotoGuide />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              backgroundColor: colors.white,
              borderRadius: 24,
              padding: 18,
            }}
          >
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: "#CFF5E4",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="shield" size={22} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>
                Private by default
              </Text>
              <Body style={{ fontSize: 14 }}>
                Only you see your photo. Delete it anytime in Settings.
              </Body>
            </View>
          </View>
        </View>
      ),
      secondary: (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => update({ step: BUILDING, tryOnPhotoAdded: false })}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Body style={{ textAlign: "center" }}>I'll do it later</Body>
        </Pressable>
      ),
    },
  };
  const screen = screens[step] ?? screens[1]!;
  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={gradients.yellow}
          style={{
            paddingTop: insets.top + 20,
            paddingHorizontal: 20,
            paddingBottom: 26,
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
            gap: 22,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <RoundButton name="arrow-left" label="Back" onPress={back} />
            <View
              style={{
                flex: 1,
                height: 8,
                borderRadius: 4,
                backgroundColor: "rgba(20,18,31,0.12)",
              }}
            >
              <View
                style={{
                  width: `${PROGRESS[step]! * 100}%`,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.ink,
                }}
              />
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <Heading size={30} style={{ letterSpacing: -1 }}>
              {screen.title}
            </Heading>
            <Body style={{ fontFamily: fonts.medium, color: "#3B3647" }}>
              {screen.subtitle}
            </Body>
          </View>
        </LinearGradient>
        <View style={{ padding: 20, paddingTop: 22 }}>{screen.body}</View>
      </ScrollView>
      <View
        style={{
          position: "absolute",
          left: 20,
          right: 20,
          bottom: insets.bottom + (screen.secondary ? 6 : 24),
          gap: 4,
        }}
      >
        <Button
          title={screen.cta}
          disabled={!screen.ready}
          style={{ minHeight: 60, borderRadius: 22 }}
          onPress={screen.next ?? (() => go(step + 1))}
        />
        {screen.secondary}
      </View>
    </View>
  );
}
