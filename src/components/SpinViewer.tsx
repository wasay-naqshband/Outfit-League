import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import { Body, Icon } from "./ui";
import { colors, gradients, shadow } from "../theme";

const MAX_ZOOM = 3;

// A turntable video: it loops on its own; drag pauses it and scrubs (one card
// width = one full turn); pinch or double-tap zooms. `start` skips the intro.
export function SpinViewer({
  video,
  start,
  height = 440,
}: {
  video: string;
  start: number;
  height?: number;
}) {
  const player = useVideoPlayer(video, (p) => {
    p.muted = true;
    p.play();
  });
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
          const now = Date.now();
          if (now - g.current.tap < 300) zoomTo(g.current.scale > 1 ? 1 : 2);
          g.current.tap = now;
          g.current.pinch = 0;
          g.current.from = player.currentTime;
          player.pause();
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
          if (g.current.pinch)
            return zoomTo(g.current.scale < 1.1 ? 1 : g.current.scale);
          if (g.current.scale > 1)
            ((g.current.x += s.dx), (g.current.y += s.dy));
        },
      }),
    [player, start],
  );

  return (
    <View style={{ height, borderRadius: 32, ...shadow() }}>
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
        <Animated.View
          {...responder.panHandlers}
          onLayout={(e) => (width.current = e.nativeEvent.layout.width)}
          style={{
            flex: 1,
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale },
            ],
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
          pointerEvents="none"
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
          <Icon name="refresh-cw" size={15} />
          <Body style={{ fontSize: 13, lineHeight: 16 }}>
            {zoomed ? "Double-tap to reset" : "Drag to turn · pinch to zoom"}
          </Body>
        </View>
      </LinearGradient>
    </View>
  );
}
