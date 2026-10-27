import React, { useCallback, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Animated,
  Easing,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Heading, Icon, StickerBadge } from "./ui";
import { TactileButton, useReduceMotion } from "./ScanHero";
import { useHistory, useJob } from "../lib/queries";
import { callTryOn } from "../lib/tryon-api";
import { sharePreview } from "../lib/share-image";
import { friendlyError, type TryOnJob } from "../types/tryon";
import { colors, fonts, shadow } from "../theme";
import { art } from "../data";

export const lookDate = (iso: string, long = false) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: long ? "long" : "short",
    day: "numeric",
    ...(d.getFullYear() !== new Date().getFullYear()
      ? { year: "numeric" }
      : {}),
  });
};
const fill = { position: "absolute", inset: 0 } as ViewStyle;
const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants" as const,
};

function useTwinkle() {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(1)).current;
  useFocusEffect(
    useCallback(() => {
      if (reduce) return;
      const half = {
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      };
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 0.3, ...half }),
          Animated.timing(v, { toValue: 1, ...half }),
        ]),
      );
      loop.start();
      return () => {
        loop.stop();
        v.setValue(1);
      };
    }, [reduce, v]),
  );
  return v;
}

function Thumb({
  id,
  fallback,
  rotate,
}: {
  id?: string;
  fallback: keyof typeof art;
  rotate: string;
}) {
  const uri = useJob(id).data?.afterUrl ?? undefined;
  return (
    <Image
      source={uri ? { uri } : art[fallback]}
      cachePolicy="none"
      contentFit="cover"
      style={{
        width: 36,
        height: 46,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: colors.ink,
        backgroundColor: colors.white,
        transform: [{ rotate }],
      }}
    />
  );
}

// "What should I wear?" → the AI Stylist, fronted by the two newest looks.
export function StylistCard() {
  const twinkle = useTwinkle();
  const looks = (useHistory().data ?? []).filter(
    (job) => job.status === "completed",
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="What should I wear? Your stylist picks from your closet."
      onPress={() => router.push("/stylist")}
      style={{
        backgroundColor: colors.ink,
        borderRadius: 24,
        padding: 12,
        paddingLeft: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        ...shadow(0.22),
      }}
    >
      <View
        {...hidden}
        style={{ width: 62, height: 50, justifyContent: "center" }}
      >
        <View style={{ position: "absolute", left: 0 }}>
          <Thumb id={looks[1]?.id} fallback="cream" rotate="-8deg" />
        </View>
        <View style={{ position: "absolute", left: 22 }}>
          <Thumb id={looks[0]?.id} fallback="navy" rotate="7deg" />
        </View>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Heading size={18} style={{ color: colors.white, flexShrink: 1 }}>
            What should I wear?
          </Heading>
          <Animated.View {...hidden} style={{ opacity: twinkle }}>
            <Icon name="sparkles" size={14} color={colors.yellow} />
          </Animated.View>
        </View>
        <Text
          style={{ fontFamily: fonts.body, fontSize: 13, color: "#D9D6E3" }}
        >
          Your stylist picks from your closet.
        </Text>
      </View>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.yellow,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="arrow-right" size={20} />
      </View>
    </Pressable>
  );
}

// Bottom sheet over a dimmed screen; tapping the backdrop closes it.
function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityLabel="Close"
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(20,18,31,0.55)" }}
      />
      <View
        accessibilityViewIsModal
        style={{
          backgroundColor: colors.cream,
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          paddingTop: 10,
          paddingHorizontal: 20,
          paddingBottom: 34 + insets.bottom,
          gap: 16,
        }}
      >
        <View
          style={{
            alignSelf: "center",
            width: 40,
            height: 5,
            borderRadius: 3,
            backgroundColor: "#D9D5C4",
          }}
        />
        {children}
      </View>
    </Modal>
  );
}

type Action = { label: string; destructive?: boolean; run: () => void };

function MenuRow({ action, onDone }: { action: Action; onDone: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        onDone();
        action.run();
      }}
      style={({ pressed }) => ({
        minHeight: 52,
        justifyContent: "center",
        paddingHorizontal: 16,
        borderRadius: 16,
        backgroundColor: pressed ? colors.chip : colors.white,
      })}
    >
      <Text
        style={{
          fontFamily: fonts.bold,
          fontSize: 16,
          color: action.destructive ? "#D63B24" : colors.ink,
        }}
      >
        {action.label}
      </Text>
    </Pressable>
  );
}

function LookCard({
  job,
  featured,
  onMore,
}: {
  job: TryOnJob;
  featured?: boolean;
  onMore: (job: TryOnJob, uri?: string) => void;
}) {
  const uri = useJob(job.id).data?.afterUrl ?? undefined;
  const date = lookDate(job.created_at);
  const more = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="More actions"
      onPress={() => onMore(job, uri)}
      style={{
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.94)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name="more-horizontal" size={22} />
    </Pressable>
  );
  return (
    <View
      style={{
        height: featured ? 300 : 236,
        borderRadius: featured ? 30 : 26,
        borderWidth: 4,
        borderColor: colors.white,
        backgroundColor: "#DCD5FF",
        ...shadow(featured ? 0.2 : 0.14),
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${featured ? "Your AI look" : "AI look"}, ${lookDate(job.created_at, true)}, private`}
        onPress={() =>
          router.push({ pathname: "/result", params: { job: job.id } })
        }
        style={{
          flex: 1,
          borderRadius: featured ? 26 : 22,
          overflow: "hidden",
        }}
      >
        {uri && (
          <Image
            source={{ uri }}
            cachePolicy="none"
            contentFit="cover"
            contentPosition={{ left: "50%", top: "30%" }}
            transition={200}
            style={{ flex: 1 }}
          />
        )}
        <LinearGradient
          {...hidden}
          pointerEvents="none"
          colors={
            featured
              ? [
                  "rgba(20,18,31,0.25)",
                  "rgba(20,18,31,0)",
                  "rgba(20,18,31,0)",
                  "rgba(20,18,31,0.82)",
                ]
              : ["rgba(20,18,31,0)", "rgba(20,18,31,0)", "rgba(20,18,31,0.8)"]
          }
          locations={featured ? [0, 0.28, 0.5, 1] : [0, 0.45, 1]}
          style={fill}
        />
      </Pressable>
      <View pointerEvents="box-none" style={fill}>
        {featured ? (
          <>
            <View
              {...hidden}
              style={{
                position: "absolute",
                left: 14,
                top: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: "rgba(255,255,255,0.94)",
                borderRadius: 999,
                paddingVertical: 6,
                paddingHorizontal: 12,
              }}
            >
              <Icon name="lock" size={13} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 12 }}>
                Private
              </Text>
            </View>
            <View
              {...hidden}
              style={{ position: "absolute", right: 14, top: 14 }}
            >
              <StickerBadge rotate="6deg" size={15}>
                Latest
              </StickerBadge>
            </View>
          </>
        ) : (
          <View
            {...hidden}
            style={{
              position: "absolute",
              left: 12,
              top: 12,
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: colors.white,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="lock" size={13} />
          </View>
        )}
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: featured ? 16 : 12,
            right: 12,
            bottom: featured ? 14 : 12,
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 8,
          }}
        >
          <View pointerEvents="none" {...hidden} style={{ flex: 1 }}>
            <Heading size={featured ? 22 : 16} style={{ color: colors.white }}>
              {featured ? "Your AI look" : "AI look"}
            </Heading>
            <Text
              style={{
                fontFamily: fonts.medium,
                fontSize: featured ? 13 : 12,
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {featured ? `${date} · Try-on` : date}
            </Text>
          </View>
          {featured && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Battle it"
              onPress={() => battle(job.id)}
              style={({ pressed }) => ({
                height: 44,
                borderRadius: 14,
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: colors.yellow,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Icon name="zap" size={18} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 15 }}>
                Battle it
              </Text>
            </Pressable>
          )}
          {more}
        </View>
      </View>
    </View>
  );
}

const battle = (id: string) =>
  router.push({
    pathname: "/battle-create",
    params: { kind: "versus", look: id },
  });

function Skeleton({ height, radius }: { height: number; radius: number }) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(1)).current;
  useFocusEffect(
    useCallback(() => {
      if (reduce) return;
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(v, {
            toValue: 0.55,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }, [reduce, v]),
  );
  return (
    <Animated.View
      style={{
        flex: 1,
        height,
        borderRadius: radius,
        backgroundColor: colors.chip,
        opacity: v,
      }}
    />
  );
}

export function AiLooksTab({ search }: { search: string }) {
  const history = useHistory();
  const client = useQueryClient();
  const reduce = useReduceMotion();
  const [menu, setMenu] = useState<{
    job: TryOnJob;
    uri?: string;
    actions: Action[];
  } | null>(null);
  const [target, setTarget] = useState<{ job: TryOnJob; uri?: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const all = (history.data ?? []).filter((job) => job.status === "completed");
  const q = search.trim().toLowerCase();
  const looks = q
    ? all.filter((job) =>
        `ai look ${lookDate(job.created_at)} ${lookDate(job.created_at, true)}`
          .toLowerCase()
          .includes(q),
      )
    : all;
  const [first, ...rest] = looks;

  function openMenu(job: TryOnJob, uri: string | undefined, featured: boolean) {
    const actions: Action[] = [
      {
        label: "Compare",
        run: () =>
          router.push({ pathname: "/result", params: { job: job.id } }),
      },
      ...(uri
        ? [
            {
              label: "Share",
              run: () => void sharePreview(uri).catch(() => {}),
            },
          ]
        : []),
      ...(featured ? [] : [{ label: "Battle it", run: () => battle(job.id) }]),
      {
        label: "Delete look",
        destructive: true,
        run: () => {
          setError("");
          setTarget({ job, uri });
        },
      },
    ];
    if (Platform.OS === "ios")
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...actions.map((a) => a.label), "Cancel"],
          destructiveButtonIndex: actions.length - 1,
          cancelButtonIndex: actions.length,
        },
        (i) => actions[i]?.run(),
      );
    else setMenu({ job, uri, actions });
  }

  async function remove() {
    if (!target || busy) return;
    setBusy(true);
    setError("");
    try {
      const { job } = target;
      await callTryOn({ action: "delete", id: job.id });
      setTarget(null);
      if (!reduce)
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      client.setQueryData<TryOnJob[]>(["tryon-history", job.owner_id], (jobs) =>
        jobs?.filter((j) => j.id !== job.id),
      );
      client.removeQueries({ queryKey: ["tryon-job", job.owner_id, job.id] });
      void client.invalidateQueries({ queryKey: ["tryon-history"] });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <View style={{ gap: 4 }}>
        <Heading size={28} style={{ letterSpacing: -1 }}>
          Your fits, reimagined.
        </Heading>
        <Text
          style={{ fontFamily: fonts.body, fontSize: 14, color: "#4B475A" }}
        >
          Tap a look to compare, save or share.
        </Text>
      </View>
      {history.isPending ? (
        <View accessibilityLabel="Loading your looks" style={{ gap: 12 }}>
          <Skeleton height={300} radius={30} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Skeleton height={236} radius={26} />
            <Skeleton height={236} radius={26} />
          </View>
        </View>
      ) : history.isError ? (
        <EmptyCard
          title="Your looks couldn’t load."
          body="Check your connection and try again."
          cta="Try again"
          onPress={() => void history.refetch()}
        />
      ) : !first ? (
        q ? (
          <Text
            style={{
              fontFamily: fonts.medium,
              fontSize: 15,
              color: colors.text2,
            }}
          >
            No looks match “{search.trim()}”
          </Text>
        ) : (
          <EmptyCard
            title="No AI looks yet"
            body="Try an outfit on and it’ll show up here."
            cta="Try something on"
            onPress={() => router.push("/(tabs)/try-on")}
          />
        )
      ) : (
        <View style={{ gap: 12 }}>
          <LookCard
            key={first.id}
            job={first}
            featured
            onMore={(j, u) => openMenu(j, u, true)}
          />
          {!!rest.length && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {rest.map((job) => (
                <View key={job.id} style={{ width: "48.2%" }}>
                  <LookCard
                    job={job}
                    onMore={(j, u) => openMenu(j, u, false)}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Full try-on history. Includes failed and pending try-ons."
        onPress={() => router.push("/history")}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 22,
          borderWidth: 2,
          borderStyle: "dashed",
          borderColor: "#CFCAD9",
          marginBottom: 90,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: "#F1EEE4",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="clock" size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15 }}>
            Full try-on history
          </Text>
          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: 12,
              color: colors.text3,
            }}
          >
            Includes failed and pending try-ons
          </Text>
        </View>
        <Icon name="chevron-right" size={20} color={colors.text3} />
      </Pressable>

      <Sheet visible={!!menu} onClose={() => setMenu(null)}>
        <View style={{ gap: 8 }}>
          {menu?.actions.map((a) => (
            <MenuRow key={a.label} action={a} onDone={() => setMenu(null)} />
          ))}
        </View>
      </Sheet>

      <Sheet visible={!!target} onClose={() => !busy && setTarget(null)}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <View
            {...hidden}
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
            {target?.uri && (
              <Image
                source={{ uri: target.uri }}
                cachePolicy="none"
                contentFit="cover"
                style={{ flex: 1 }}
              />
            )}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Heading size={24}>Delete this look?</Heading>
            <Text
              style={{
                fontFamily: fonts.body,
                fontSize: 13,
                color: colors.text3,
              }}
            >
              Your AI look · {target ? lookDate(target.job.created_at) : ""}
            </Text>
          </View>
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
            This removes the look and both source photos. It can’t be undone.
          </Text>
        </View>
        {!!error && (
          <Text
            accessibilityLiveRegion="polite"
            style={{ fontFamily: fonts.medium, fontSize: 14, color: "#A3321F" }}
          >
            {error}
          </Text>
        )}
        <View
          style={{ height: 62, borderRadius: 20, backgroundColor: colors.ink }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete look and photos"
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
              Delete look and photos
            </Text>
          </Pressable>
        </View>
        <TactileButton
          title="Keep it"
          fill={colors.white}
          disabled={busy}
          onPress={() => setTarget(null)}
        />
      </Sheet>
    </>
  );
}

function EmptyCard({
  title,
  body,
  cta,
  onPress,
}: {
  title: string;
  body: string;
  cta: string;
  onPress: () => void;
}) {
  return (
    <View
      style={{
        borderRadius: 26,
        borderWidth: 2,
        borderStyle: "dashed",
        borderColor: "#CFCAD9",
        padding: 22,
        gap: 10,
        alignItems: "center",
      }}
    >
      <Image
        {...hidden}
        source={require("../../assets/closet/hanger.png")}
        style={{ width: 88, height: 100 }}
      />
      <Heading size={22} style={{ textAlign: "center" }}>
        {title}
      </Heading>
      <Text
        style={{
          fontFamily: fonts.body,
          fontSize: 14,
          color: colors.text2,
          textAlign: "center",
        }}
      >
        {body}
      </Text>
      <TactileButton
        icon="sparkles"
        title={cta}
        style={{ alignSelf: "stretch", marginTop: 6 }}
        onPress={onPress}
      />
    </View>
  );
}
