import React, { useEffect, useRef, useState } from "react";
import { Alert, Modal, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ActionTile,
  Body,
  Button,
  ErrorState,
  FlatHeader,
  Icon,
  LoadingSkeleton,
  Page,
  SegmentedControl,
  StickerBadge,
} from "../components/ui";
import { FloatingTabBar } from "../components/FloatingTabBar";
import { SpinViewer } from "../components/SpinViewer";
import { CookingLoader, SPIN_MESSAGES } from "../components/CookingLoader";
import { useApp } from "../lib/state";
import { useJob, useWallet } from "../lib/queries";
import { rateLook, saveLook, startSpin } from "../lib/tryon-api";
import { RatingCard } from "../components/Stylist";
import { Lookalikes } from "../components/Lookalikes";
import { sharePreview } from "../lib/share-image";
import { friendlyError } from "../types/tryon";
import { outOfCredits } from "../lib/credits";
import { colors, gradients, shadow } from "../theme";

export default function LiveResult({ id }: { id: string }) {
  const { session } = useApp();
  const query = useJob(id);
  const wallet = useWallet();
  const client = useQueryClient();
  const [segment, setSegment] = useState("After");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageError, setImageError] = useState(false);
  // The photo's own shape, so it fills the width with no side bars.
  const [ratio, setRatio] = useState(2 / 3);
  const view = query.data;
  const uri = segment === "Before" ? view?.beforeUrl : view?.afterUrl;
  const spin = view?.spin;
  const spinStart = useRef(0);
  const [spinOpen, setSpinOpen] = useState(true);
  // Opening the 360° tab shows the full-screen viewer again.
  useEffect(() => setSpinOpen(true), [segment]);
  useEffect(() => setImageError(false), [uri]);
  useEffect(() => {
    if (view && view.job.status !== "completed")
      router.replace({ pathname: "/generation/[id]", params: { id } });
  }, [view?.job.status, id]);
  async function save() {
    if (!view?.look || busy) return;
    setBusy(true);
    setError("");
    try {
      await saveLook(view.look.id, !view.look.saved);
      await query.refetch();
      await client.invalidateQueries({ queryKey: ["tryon-history"] });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  // 360° views are for paying Pro members; a free trial includes try-ons only.
  const paidPro =
    !!wallet.data?.subscription_active && !wallet.data?.subscription_trial;
  function needPro() {
    if (wallet.data?.subscription_trial)
      Alert.alert(
        "360° views come with Pro",
        "Your free trial includes try-ons. 360° views unlock when your Pro membership starts.",
      );
    else router.push({ pathname: "/paywall", params: { source: "feature" } });
  }
  async function makeSpin() {
    if (busy) return;
    if (!paidPro) return needPro();
    const included = wallet.data?.subscription_spins ?? 0;
    const permanentCredits = Math.max(
      0,
      (wallet.data?.available ?? 0) - (wallet.data?.subscription_tryons ?? 0),
    );
    if (included < 1 && permanentCredits < 1) {
      outOfCredits("360° view");
      return;
    }
    spinStart.current = Date.now();
    setBusy(true);
    setError("");
    try {
      client.setQueryData(
        ["tryon-job", session?.user.id, id],
        await startSpin(id),
      );
      await client.invalidateQueries({ queryKey: ["wallet"] });
    } catch (e) {
      if (e instanceof Error && e.message === "PRO_REQUIRED") needPro();
      else if (e instanceof Error && e.message === "NO_CREDITS")
        outOfCredits("360° view");
      else setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  async function rate() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { rating } = await rateLook(id);
      client.setQueryData(
        ["tryon-job", session?.user.id, id],
        (old: typeof view) => old && { ...old, job: { ...old.job, rating } },
      );
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const latest = await query.refetch();
      if (!latest.data?.afterUrl) throw new Error("No preview is available.");
      await sharePreview(latest.data.afterUrl);
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError"))
        setError("We couldn’t share that preview. Refresh it and try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ flex: 1 }}>
      <Page>
        <FlatHeader title="Your look">
          <SegmentedControl
            options={["Before", "After", "360°"]}
            selected={segment}
            onChange={setSegment}
          />
        </FlatHeader>
        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          {!session ? (
            <Button
              title="Sign in to view this private look"
              onPress={() => router.push("/auth")}
            />
          ) : query.isError ? (
            <ErrorState
              message={friendlyError(query.error)}
              retry={() => {
                void query.refetch();
              }}
            />
          ) : !view ? (
            <LoadingSkeleton />
          ) : segment === "360°" ? (
            <>
              <LinearGradient
                colors={gradients.lavender}
                style={{
                  height: 359,
                  borderRadius: 32,
                  borderWidth: 4,
                  borderColor: colors.white,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 16,
                  padding: 24,
                }}
              >
                <Icon name="refresh-cw" size={48} />
                <Body style={{ textAlign: "center" }}>
                  {spin?.status === "failed"
                    ? friendlyError(
                        new Error(spin.error ?? "GENERATION_FAILED"),
                      )
                    : "See this look from the front, sides and back."}
                </Body>
              </LinearGradient>
              {spin?.status === "completed" ? (
                <Button
                  title="Open 360° view"
                  icon="refresh-cw"
                  onPress={() => setSpinOpen(true)}
                />
              ) : (
                spin?.status !== "processing" && (
                  <Button
                    title={
                      busy
                        ? "Please wait…"
                        : !paidPro
                          ? "360° view · Pro"
                          : (wallet.data?.subscription_spins ?? 0) > 0
                            ? `Make 360° view · ${wallet.data?.subscription_spins} included`
                            : "Make 360° view · 1 credit"
                    }
                    icon="sparkles"
                    onPress={() => {
                      void makeSpin();
                    }}
                  />
                )
              )}
              {!!error && (
                <Body
                  style={{
                    padding: 16,
                    borderRadius: 18,
                    backgroundColor: colors.chip,
                  }}
                >
                  {error}
                </Body>
              )}
              <Body style={{ fontSize: 13 }}>
                Your AI try-on image is sent to Google Gemini to create a
                turning video. Sides and back are AI guesses, not photos. Failed
                views refund the credit automatically. Deleting this look
                deletes its 360° view.
              </Body>
            </>
          ) : (
            <>
              <View
                style={{
                  marginHorizontal: -12,
                  aspectRatio: ratio,
                  maxHeight: 640,
                  borderRadius: 28,
                  ...shadow(),
                }}
              >
                <View
                  style={{
                    flex: 1,
                    borderRadius: 28,
                    overflow: "hidden",
                    backgroundColor: colors.white,
                  }}
                >
                  {uri && !imageError && (
                    <Image
                      source={{ uri }}
                      contentFit="contain"
                      cachePolicy="none"
                      style={{ width: "100%", height: "100%" }}
                      accessibilityLabel={
                        segment === "Before"
                          ? "Your original private photo"
                          : "AI-generated style preview"
                      }
                      onError={() => setImageError(true)}
                      onLoad={(e) =>
                        e.source.width &&
                        e.source.height &&
                        setRatio(e.source.width / e.source.height)
                      }
                    />
                  )}
                  <View
                    style={{
                      position: "absolute",
                      left: 14,
                      top: 14,
                      backgroundColor: colors.white,
                      padding: 10,
                      borderRadius: 17,
                      flexDirection: "row",
                      gap: 6,
                    }}
                  >
                    <Icon name="sparkles" size={15} />
                    <Body style={{ fontSize: 13, lineHeight: 16 }}>
                      {segment === "Before" ? "Your original" : "AI preview"}
                    </Body>
                  </View>
                  {segment === "After" && (
                    <StickerBadge
                      style={{ position: "absolute", right: 12, bottom: 24 }}
                    >
                      Looks good on you
                    </StickerBadge>
                  )}
                </View>
              </View>
              {(imageError || !uri) && (
                <ErrorState
                  message="Your private image link may have expired. Refresh to load it again."
                  retry={() => {
                    setImageError(false);
                    void query.refetch();
                  }}
                />
              )}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <ActionTile
                  label={
                    busy
                      ? "Please wait…"
                      : view.look?.saved
                        ? "Saved"
                        : "Save look"
                  }
                  icon="heart"
                  onPress={() => {
                    void save();
                  }}
                />
                <ActionTile
                  label="Battle it"
                  icon="zap"
                  onPress={() => router.push("/battle-preview")}
                />
                <ActionTile
                  label="Share"
                  icon="share"
                  onPress={() => {
                    void share();
                  }}
                />
              </View>
              {!!error && (
                <Body
                  style={{
                    padding: 16,
                    borderRadius: 18,
                    backgroundColor: colors.chip,
                  }}
                >
                  {error}
                </Body>
              )}
              {view.job.rating ? (
                <RatingCard rating={view.job.rating} />
              ) : (
                <Button
                  icon="sparkles"
                  title={busy ? "Please wait…" : "Rate my fit · free"}
                  onPress={() => {
                    void rate();
                  }}
                />
              )}
              <Lookalikes id={id} />
              <Button
                secondary
                title="Your private look history"
                onPress={() => router.push("/history")}
              />
              <Button
                secondary
                icon="shopping-bag"
                title="Shop similar styles"
                onPress={() =>
                  router.push({ pathname: "/shop", params: { job: id } })
                }
              />
              <Button
                secondary
                title="Try another outfit"
                icon="sparkles"
                onPress={() => router.replace("/(tabs)/try-on")}
              />
              <Body style={{ fontSize: 13 }}>
                Private until you choose to share. AI previews show style, not
                garment fit or sizing. Shopping searches saved details and
                manually selected categories; it does not identify this image.
              </Body>
            </>
          )}
        </View>
      </Page>
      {/* Full-screen wait while the 360° video is made; closing keeps it cooking. */}
      <Modal
        visible={segment === "360°" && (busy || spin?.status === "processing")}
        animationType="fade"
        statusBarTranslucent
      >
        <CookingLoader
          fullScreen
          messages={SPIN_MESSAGES}
          seconds={60}
          startedAt={spinStart.current || undefined}
          onClose={() => setSegment("After")}
        />
      </Modal>
      <Modal
        visible={
          segment === "360°" &&
          spinOpen &&
          spin?.status === "completed" &&
          !!spin.sheetUrl
        }
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSpinOpen(false)}
      >
        {spin?.sheetUrl && (
          <SpinViewer
            video={spin.sheetUrl}
            start={spin.start}
            onClose={() => setSpinOpen(false)}
          />
        )}
      </Modal>
      <FloatingTabBar active="Try On" />
    </View>
  );
}
