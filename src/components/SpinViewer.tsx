import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView, type VideoThumbnail } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Body, Icon } from "./ui";
import { colors, gradients } from "../theme";

const MAX_ZOOM = 3;
const TAP = 8;
const FRAMES = 60;

// Seeking a video on every move stutters (it decodes from the previous
// keyframe), so the drag flips through stills grabbed once up front.
async function grabFrames(
  player: ReturnType<typeof useVideoPlayer>,
  source: string,
  start: number,
): Promise<(string | VideoThumbnail)[]> {
  const times = (duration: number) =>
    Array.from(
      { length: FRAMES },
      (_, i) => start + (i * (duration - start)) / FRAMES,
    );
  if (Platform.OS !== "web")
    return player.generateThumbnailsAsync(times(player.duration), {
      maxWidth: 540,
    });
  const v = document.createElement("video");
  v.crossOrigin = "anonymous";
  v.muted = true;
  v.preload = "auto";
  v.src = source;
  await new Promise((ok, fail) => ((v.onloadeddata = ok), (v.onerror = fail)));
  const c = document.createElement("canvas");
  c.width = 540;
  c.height = Math.round((540 * v.videoHeight) / v.videoWidth);
  const out: string[] = [];
  for (const t of times(v.duration)) {
    v.currentTime = t;
    await new Promise((ok) => (v.onseeked = ok));
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    out.push(c.toDataURL("image/jpeg", 0.85));
  }
  return out;
}

// Full-screen turntable video (shown in a Modal, so no page scroll or iOS
// back-swipe can steal the drag): it loops on its own; drag pauses it and
// scrubs (one screen width = one full turn); pinch or double-tap zooms.
// `start` skips the intro.
export function SpinViewer({
  video,
  start,
  onClose,
}: {
  video: string;
  start: number;
  onClose: () => void;
}) {
  // Signed links refresh on refetch; keep the first so the player never reloads.
  const [source] = useState(video);
  const player = useVideoPlayer(source, (p) => {
    p.muted = true;
    p.seekTolerance = { toleranceBefore: 0.05, toleranceAfter: 0.05 };
    p.play();
  });
  const insets = useSafeAreaInsets();
  const [zoomed, setZoomed] = useState(false);
  const width = useRef(1);
  const scale = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY()).current;
  const g = useRef({
    scale: 1,
    x: 0,
    y: 0,
    pinch: 0,
    tap: 0,
    from: start,
    frame: -1,
  });
  const [frames, setFrames] = useState<(string | VideoThumbnail)[]>([]);
  const [frame, setFrame] = useState<number | null>(null);
  const grabbing = useRef(false);

  // Skip the intro once loaded (seeking earlier is ignored), and loop past it.
  useEffect(() => {
    const restart = () => {
      player.currentTime = start;
      player.play();
    };
    const onReady = () => {
      if (player.currentTime < start) restart();
      if (grabbing.current) return;
      grabbing.current = true;
      // Without stills (e.g. a blocked canvas) the drag falls back to seeking.
      grabFrames(player, source, start).then(setFrames, () => {});
    };
    // The player may already be ready before this listener is attached.
    if (player.status === "readyToPlay") onReady();
    const ready = player.addListener("statusChange", ({ status }) => {
      if (status === "readyToPlay") onReady();
    });
    const end = player.addListener("playToEnd", restart);
    return () => (ready.remove(), end.remove());
  }, [player, start, source]);

  const zoomTo = (to: number) => {
    g.current.scale = to;
    if (to === 1) ((g.current.x = 0), (g.current.y = 0));
    Animated.spring(scale, { toValue: to, useNativeDriver: true }).start();
    Animated.spring(pan, {
      toValue: { x: g.current.x, y: g.current.y },
      useNativeDriver: true,
    }).start();
    setZoomed(to > 1);
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          g.current.pinch = 0;
          g.current.frame = -1;
          g.current.from = player.currentTime;
          player.pause();
          player.scrubbingModeOptions = { scrubbingModeEnabled: true };
        },
        onPanResponderMove: (e, s) => {
          const [a, b] = e.nativeEvent.touches;
          if (a && b) {
            const d = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
            if (!g.current.pinch) g.current.pinch = d / g.current.scale;
            const next = Math.min(MAX_ZOOM, Math.max(1, d / g.current.pinch));
            g.current.scale = next;
            scale.setValue(next);
          } else if (g.current.scale > 1) {
            pan.setValue({ x: g.current.x + s.dx, y: g.current.y + s.dy });
          } else {
            const span = Math.max(0.1, player.duration - start);
            const t = g.current.from - start - (s.dx / width.current) * span;
            const at = ((t % span) + span) % span;
            if (!frames.length) player.currentTime = start + at;
            else {
              g.current.frame = Math.round((at / span) * FRAMES) % FRAMES;
              setFrame(g.current.frame);
            }
          }
        },
        onPanResponderRelease: (_, s) => {
          player.scrubbingModeOptions = { scrubbingModeEnabled: false };
          if (g.current.frame >= 0) {
            // Park the video on the same angle, then drop the still once it has.
            const span = Math.max(0.1, player.duration - start);
            player.currentTime = start + (g.current.frame * span) / FRAMES;
            setTimeout(() => setFrame(null), 400);
          }
          if (g.current.pinch)
            return zoomTo(g.current.scale < 1.1 ? 1 : g.current.scale);
          // Only a still, quick touch counts as a tap; drags never zoom.
          if (Math.abs(s.dx) < TAP && Math.abs(s.dy) < TAP) {
            const now = Date.now();
            if (now - g.current.tap < 300) {
              g.current.tap = 0;
              return zoomTo(g.current.scale > 1 ? 1 : 2);
            }
            g.current.tap = now;
          }
          if (g.current.scale > 1)
            ((g.current.x += s.dx), (g.current.y += s.dy));
        },
      }),
    [player, start, frames],
  );

  return (
    <LinearGradient colors={gradients.lavender} style={{ flex: 1 }}>
      <Animated.View
        {...responder.panHandlers}
        onLayout={(e) => (width.current = e.nativeEvent.layout.width)}
        style={{
          flex: 1,
          transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale }],
        }}
      >
        <VideoView
          player={player}
          nativeControls={false}
          contentFit="contain"
          pointerEvents="none"
          style={{ width: "100%", height: "100%" }}
          accessibilityLabel="AI 360° preview video"
        />
        {frame !== null && (
          <Image
            source={frames[frame]}
            contentFit="contain"
            pointerEvents="none"
            style={{ position: "absolute", width: "100%", height: "100%" }}
          />
        )}
      </Animated.View>
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 20,
          right: 20,
          top: insets.top + 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close 360° view"
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.white,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="x" size={20} />
        </Pressable>
        <View
          pointerEvents="none"
          style={{
            backgroundColor: colors.white,
            padding: 10,
            borderRadius: 17,
            flexDirection: "row",
            gap: 6,
          }}
        >
          <Icon name="refresh-cw" size={15} />
          <Body style={{ fontSize: 13, lineHeight: 16 }}>
            {zoomed ? "Double-tap to reset" : "Drag to turn · pinch to zoom"}
          </Body>
        </View>
      </View>
      {/* Google's own "AI" mark is burned in and clipped at the frame edge,
          so show a full label of ours where it can always be read. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          alignSelf: "center",
          bottom: insets.bottom + 20,
          backgroundColor: colors.ink,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 17,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Icon name="sparkles" size={14} color={colors.yellow} />
        <Body style={{ fontSize: 13, lineHeight: 16, color: colors.white }}>
          AI-generated
        </Body>
      </View>
    </LinearGradient>
  );
}
