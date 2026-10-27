import React, { useRef, useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Body,
  Button,
  Heading,
  Icon,
  CreditPill,
  Page,
  SettingsButton,
  StickerBadge,
} from "../../src/components/ui";
import { CookingLoader } from "../../src/components/CookingLoader";
import {
  HowScanWorks,
  ScanViewfinderHero,
  TactileButton,
} from "../../src/components/ScanHero";
import { LinearGradient } from "expo-linear-gradient";
import { PieceOptions } from "../../src/components/ShopTheLook";
import { ScanReport } from "../../src/components/ScanReport";
import { useApp } from "../../src/lib/state";
import { useTryOnDraft } from "../../src/lib/tryon-draft";
import { styleLabel, useOnboarding } from "../../src/lib/onboarding";
import { analytics } from "../../src/lib/analytics";
import { disposePhoto, pickPhoto } from "../../src/lib/photos";
import { saveLibraryItem } from "../../src/lib/library";
import { scanPhoto, type Lookalike, type Scan } from "../../src/lib/tryon-api";
import { friendlyError, type LocalPhoto } from "../../src/types/tryon";
import { colors, fonts, gradients, shadow } from "../../src/theme";
import { sharePreview } from "../../src/lib/share-image";

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [limited, setLimited] = useState(false);
  const startedAt = useRef(0);

  async function snap(camera: boolean) {
    if (busy) return;
    if (!session) {
      router.push("/auth");
      return;
    }
    setError("");
    setLimited(false);
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
      setLimited(e instanceof Error && e.message === "SCAN_DAILY_LIMIT");
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
  async function save() {
    if (!photo || !result || saved || saving) return;
    setSaving(true);
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
          notes: [scan.vibeLine, ...scan.details.map((detail) => detail.value)]
            .filter(Boolean)
            .join(" · "),
          tags: scan.vibe,
          source_url: "",
        },
        photo,
      );
      await client.invalidateQueries({ queryKey: ["library"] });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const scan = result?.scan;
  if (scan && photo && !busy)
    return (
      <ScanReport
        photo={photo}
        scan={scan}
        items={result.items}
        saved={saved}
        saving={saving}
        error={error}
        onBack={() => {
          void disposePhoto(photo);
          setPhoto(null);
          setResult(null);
          setSaved(false);
        }}
        onShare={() => {
          void sharePreview(photo.uri, scan.name).catch(() =>
            setError("We couldn’t share that scan. Please try again."),
          );
        }}
        onSave={() => void save()}
        onTryOn={() => {
          draft.setGarment(photo);
          setPhoto(null);
          setResult(null);
          router.push("/(tabs)/try-on");
        }}
        onScanAnother={() => void snap(Platform.OS !== "web")}
        onGallery={() => void snap(false)}
      />
    );
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Heading size={32} style={{ flex: 1, letterSpacing: -1 }}>
            Scan
          </Heading>
          <CreditPill compact />
          <SettingsButton />
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
            Spot it. Snap it.
          </Heading>
          <StickerBadge size={24} rotate="-5deg">
            Get it.
          </StickerBadge>
        </View>
      </LinearGradient>
      <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 18 }}>
        <Modal visible={busy} animationType="fade" statusBarTranslucent>
          <CookingLoader
            fullScreen
            messages={MESSAGES}
            seconds={20}
            startedAt={startedAt.current}
          />
        </Modal>
        {!busy && !scan && (
          <>
            <ScanViewfinderHero />
            <View style={{ flexDirection: "row", gap: 12, marginTop: 2 }}>
              <TactileButton
                icon="camera"
                title="Snap a piece"
                style={{ flex: 1 }}
                onPress={() => void snap(Platform.OS !== "web")}
              />
              <TactileButton
                icon="image"
                label="Choose from gallery"
                fill={colors.white}
                style={{ width: 60 }}
                onPress={() => void snap(false)}
              />
            </View>
            <View style={{ marginBottom: 28 }}>
              <HowScanWorks />
            </View>
          </>
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
        {limited && (
          <Button
            title="Get Pro"
            onPress={() =>
              router.push({
                pathname: "/paywall",
                params: { source: "feature" },
              })
            }
          />
        )}
        {scan && photo && !busy && (
          <>
            <Image
              source={{ uri: photo.uri }}
              contentFit="contain"
              style={{
                width: "100%",
                aspectRatio: photo.width / photo.height,
                maxHeight: 520,
                borderRadius: 28,
                backgroundColor: colors.chip,
              }}
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
                  <Body key={d.label + d.value} style={{ fontSize: 14 }}>
                    {d.label}: {d.value}
                  </Body>
                ))}
                {!!scan.idea && (
                  <Body style={{ fontSize: 14 }}>{scan.idea}</Body>
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
        {!busy && !!scan && (
          <View style={{ flexDirection: "row", gap: 10 }}>
            {Platform.OS !== "web" && (
              <View style={{ flex: 1 }}>
                <Button
                  secondary
                  icon="camera"
                  title="Scan another"
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
