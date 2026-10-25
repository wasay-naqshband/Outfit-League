import React, { useCallback, useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Body,
  Button,
  Heading,
  Icon,
  Page,
  SettingsButton,
} from "../../src/components/ui";
import { CookingLoader } from "../../src/components/CookingLoader";
import { PieceOptions } from "../../src/components/ShopTheLook";
import { useApp } from "../../src/lib/state";
import { useTryOnDraft } from "../../src/lib/tryon-draft";
import { styleLabel, useOnboarding } from "../../src/lib/onboarding";
import { analytics } from "../../src/lib/analytics";
import { disposePhoto, pickPhoto } from "../../src/lib/photos";
import { saveLibraryItem } from "../../src/lib/library";
import { scanPhoto, type Lookalike, type Scan } from "../../src/lib/tryon-api";
import { friendlyError, type LocalPhoto } from "../../src/types/tryon";
import { colors, fonts, shadow } from "../../src/theme";

const MESSAGES = [
  "Zooming in on the details…",
  "Naming that colour…",
  "Reading the vibe…",
  "Checking it against your colours…",
  "Hunting it down in stores…",
];
const card = {
  backgroundColor: colors.white,
  borderRadius: 24,
  padding: 18,
  gap: 10,
  ...shadow(0.06),
};
const label = {
  fontFamily: fonts.bold,
  fontSize: 11,
  letterSpacing: 1,
  color: colors.text3,
};

// Scan: snap any piece you like out in the world → what it is, its colours,
// the vibe, how it suits you, what it goes with in your closet, where to buy.
export default function ScanTab() {
  const { session } = useApp();
  const draft = useTryOnDraft();
  const client = useQueryClient();
  const styles = useOnboarding().answers.styles.map(styleLabel);
  const [photo, setPhoto] = useState<LocalPhoto | null>(null);
  const [result, setResult] = useState<{
    scan: Scan;
    items: Lookalike[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const startedAt = useRef(0);
  const opened = useRef(false);

  async function snap(camera: boolean) {
    if (busy) return;
    setError("");
    try {
      const picked = await pickPhoto(camera);
      if (!picked) return;
      void disposePhoto(photo);
      setPhoto(picked);
      setResult(null);
      setSaved(false);
      setBusy(true);
      startedAt.current = Date.now();
      const scan = await scanPhoto(picked, styles);
      setResult(scan);
      analytics.track("scan_completed", {
        from: camera ? "camera" : "gallery",
      });
    } catch (e) {
      // Server codes have no spaces; plain messages (camera, photo size) do.
      setError(
        e instanceof Error && e.message.includes(" ")
          ? e.message
          : friendlyError(e),
      );
    } finally {
      setBusy(false);
    }
  }
  // Tapping the tab goes straight to the camera (once per visit).
  useFocusEffect(
    useCallback(() => {
      if (session && Platform.OS !== "web" && !photo && !opened.current) {
        opened.current = true;
        void snap(true);
      }
      return () => {
        opened.current = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session, photo]),
  );

  async function save() {
    if (!photo || !result || saved) return;
    setError("");
    try {
      const { scan } = result;
      await saveLibraryItem(
        "inspiration",
        {
          name: scan.name,
          category: scan.category,
          color: scan.colors[0]?.name ?? "",
          brand: "",
          notes: [scan.vibeLine, ...scan.details].filter(Boolean).join(" · "),
          tags: scan.vibe,
          source_url: "",
        },
        photo,
      );
      await client.invalidateQueries({ queryKey: ["library"] });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save. Try again.");
    }
  }

  const scan = result?.scan;
  return (
    <Page>
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 16,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Heading size={30} style={{ flex: 1 }}>
          Scan
        </Heading>
        <SettingsButton />
      </View>
      <View style={{ padding: 20, gap: 16 }}>
        {busy && (
          <CookingLoader
            messages={MESSAGES}
            seconds={20}
            startedAt={startedAt.current}
          />
        )}
        {!session ? (
          <>
            <Heading size={24}>Spot it. Snap it. Get it.</Heading>
            <Body>
              Sign in to scan any piece you see and find out what it is, how it
              suits you and where to buy it.
            </Body>
            <Button title="Sign in" onPress={() => router.push("/auth")} />
          </>
        ) : (
          !busy &&
          !scan && (
            <>
              <Heading size={24}>Spot it. Snap it. Get it.</Heading>
              <Body>
                See a piece you love, on someone, in a shop, anywhere? Snap it.
                We’ll tell you what it is, how it’ll look on you, and where to
                buy it.
              </Body>
              {photo && (
                <Image
                  source={{ uri: photo.uri }}
                  contentFit="cover"
                  style={{ height: 260, borderRadius: 28 }}
                />
              )}
            </>
          )
        )}
        {!!error && (
          <Body
            style={{
              backgroundColor: colors.chip,
              borderRadius: 18,
              padding: 16,
            }}
          >
            {error}
          </Body>
        )}
        {scan && photo && !busy && (
          <>
            <Image
              source={{ uri: photo.uri }}
              contentFit="cover"
              style={{ height: 300, borderRadius: 28 }}
            />
            <View style={{ gap: 6 }}>
              <Heading size={26}>{scan.name}</Heading>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {!!scan.vibe && <Tag text={scan.vibe} dark />}
                {!!scan.price && <Tag text={scan.price} />}
                <Tag text={scan.category} />
              </View>
            </View>

            <View style={[card, { backgroundColor: colors.ink }]}>
              <Text style={[label, { color: colors.yellow }]}>ON YOU</Text>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
              >
                <Text
                  style={{
                    fontFamily: fonts.heading,
                    fontSize: 48,
                    color: colors.yellow,
                  }}
                >
                  {scan.score}
                  <Text style={{ fontSize: 22 }}>/10</Text>
                </Text>
                <Text
                  style={{
                    flex: 1,
                    fontFamily: fonts.medium,
                    fontSize: 15,
                    color: colors.white,
                  }}
                >
                  {scan.verdict}
                </Text>
              </View>
              {!!scan.vibeLine && (
                <Text
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 14,
                    color: colors.inactive,
                  }}
                >
                  {scan.vibeLine}
                </Text>
              )}
            </View>

            {!!scan.colors.length && (
              <View style={card}>
                <Text style={label}>COLOURS</Text>
                {scan.colors.map((c) => (
                  <View
                    key={c.hex + c.name}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: c.hex,
                        borderWidth: 1,
                        borderColor: "#0001",
                      }}
                    />
                    <Text style={{ fontFamily: fonts.medium, fontSize: 15 }}>
                      {c.name}
                    </Text>
                    <Text
                      style={{
                        fontFamily: fonts.body,
                        fontSize: 13,
                        color: colors.text3,
                      }}
                    >
                      {c.hex.toUpperCase()}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {!!scan.details.length && (
              <View style={card}>
                <Text style={label}>DETAILS</Text>
                {scan.details.map((d) => (
                  <Body key={d} style={{ fontSize: 14 }}>
                    • {d}
                  </Body>
                ))}
                {!!scan.idea && (
                  <Body style={{ fontSize: 14 }}>💡 {scan.idea}</Body>
                )}
              </View>
            )}

            {!!scan.pairs.length && (
              <View style={card}>
                <Text style={label}>GOES WITH YOUR CLOSET</Text>
                <View
                  style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}
                >
                  {scan.pairs.map((p) => (
                    <Pressable
                      key={p.id}
                      accessibilityRole="button"
                      onPress={() =>
                        router.push({
                          pathname: "/library-item/[id]",
                          params: { id: p.id },
                        })
                      }
                    >
                      <Tag text={"✓ " + p.name} mint />
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <Button
              icon="sparkles"
              title="Try it on me"
              onPress={() => {
                draft.setGarment(photo);
                setPhoto(null);
                setResult(null);
                router.push("/(tabs)/try-on");
              }}
            />
            <Button
              secondary
              icon={saved ? "check" : "heart"}
              title={saved ? "Saved to Closet" : "Save to Closet"}
              disabled={saved}
              onPress={() => void save()}
            />

            <PieceOptions
              heading="Where to buy it"
              piece={{
                part: "accessory",
                name: scan.name,
                query: scan.query,
                closetId: null,
              }}
              items={result.items}
            />
          </>
        )}
        {session && !busy && (
          <View style={{ flexDirection: "row", gap: 10 }}>
            {Platform.OS !== "web" && (
              <View style={{ flex: 1 }}>
                <Button
                  secondary={!!scan}
                  icon="camera"
                  title={scan ? "Scan another" : "Snap a piece"}
                  onPress={() => void snap(true)}
                />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Button
                secondary
                icon="image"
                title="Gallery"
                onPress={() => void snap(false)}
              />
            </View>
          </View>
        )}
      </View>
    </Page>
  );
}

function Tag({
  text,
  dark,
  mint,
}: {
  text: string;
  dark?: boolean;
  mint?: boolean;
}) {
  return (
    <Text
      style={{
        overflow: "hidden",
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: dark ? colors.ink : mint ? "#CFF5E4" : colors.chip,
        color: dark ? colors.yellow : mint ? "#127A55" : colors.ink,
        fontFamily: fonts.bold,
        fontSize: 12,
      }}
    >
      {text}
    </Text>
  );
}
