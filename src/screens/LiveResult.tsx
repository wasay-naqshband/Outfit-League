import React, { useEffect, useRef, useState } from "react";
import { Modal, View } from "react-native";
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
import { useJob } from "../lib/queries";
import { saveLook, startSpin } from "../lib/tryon-api";
import { sharePreview } from "../lib/share-image";
import { friendlyError } from "../types/tryon";
import { colors, gradients, shadow } from "../theme";

export default function LiveResult({ id }: { id: string }) {
  const { session } = useApp();
  const query = useJob(id);
  const client = useQueryClient();
  const [segment, setSegment] = useState("After");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageError, setImageError] = useState(false);
  const view = query.data;
  const uri = segment === "Before" ? view?.beforeUrl : view?.afterUrl;
  const spin = view?.spin;
  const spinStart = useRef(0);
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
  async function makeSpin() {
    if (busy) return;
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
              {spin?.status === "completed" && spin.sheetUrl ? (
                <SpinViewer video={spin.sheetUrl} start={spin.start} />
              ) : (
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
              )}
              {spin?.status !== "completed" &&
                spin?.status !== "processing" && (
                  <Button
                    title={busy ? "Please wait…" : "Make 360° view · 1 credit"}
                    icon="sparkles"
                    onPress={() => {
                      void makeSpin();
                    }}
                  />
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
              <View style={{ height: 359, borderRadius: 32, ...shadow() }}>
                <LinearGradient
                  colors={gradients.lavender}
                  style={{
                    flex: 1,
                    borderRadius: 32,
                    borderWidth: 4,
                    borderColor: colors.white,
                    overflow: "hidden",
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
                </LinearGradient>
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
                title="Try another top"
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
        visible={
          segment === "360°" && (busy || spin?.status === "processing")
        }
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
      <FloatingTabBar active="Try On" />
    </View>
  );
}
