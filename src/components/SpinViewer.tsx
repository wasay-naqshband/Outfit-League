import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Body, Icon } from "./ui";
import { colors, gradients } from "../theme";

const MAX_ZOOM = 3;
const TAP = 8;

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
  const g = useRef({ scale: 1, x: 0, y: 0, pinch: 0, tap: 0, from: start });

  // Skip the intro once loaded (seeking earlier is ignored), and loop past it.
  useEffect(() => {
    const restart = () => {
      player.currentTime = start;
      player.play();
    };
    const ready = player.addListener("statusChange", ({ status }) => {
      if (status === "readyToPlay" && player.currentTime < start) restart();
    });
    const end = player.addListener("playToEnd", restart);
    return () => (ready.remove(), end.remove());
  }, [player, start]);

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
            player.currentTime = start + (((t % span) + span) % span);
          }
        },
        onPanResponderRelease: (_, s) => {
          player.scrubbingModeOptions = { scrubbingModeEnabled: false };
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
    [player, start],
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
    </LinearGradient>
  );
}
