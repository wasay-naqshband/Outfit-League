import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Body, Icon } from "./ui";
import { colors, gradients, shadow } from "../theme";

const STEP = 40; // drag distance (px) per angle
const MAX_ZOOM = 3;

// Drag to turn through the angles, pinch or double-tap to zoom. `sheet` is one
// image with the angles side by side in equal columns; only one column shows.
export function SpinViewer({
  sheet,
  angles,
  height = 440,
}: {
  sheet: string;
  angles: number;
  height?: number;
}) {
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [aspect, setAspect] = useState(16 / 9);
  const sheetWidth = box.height * aspect;
  const scale = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY()).current;
  const g = useRef({ index: 0, scale: 1, x: 0, y: 0, pinch: 0, tap: 0 });

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
            const n = angles;
            const next =
              (((g.current.index - Math.round(s.dx / STEP)) % n) + n) % n;
            setIndex((i) => (i === next ? i : next));
          }
        },
        onPanResponderRelease: (_, s) => {
          if (g.current.pinch)
            return zoomTo(g.current.scale < 1.1 ? 1 : g.current.scale);
          if (g.current.scale > 1)
            ((g.current.x += s.dx), (g.current.y += s.dy));
          setIndex((i) => ((g.current.index = i), i));
        },
      }),
    [angles],
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
          onLayout={(e) => setBox(e.nativeEvent.layout)}
          style={{
            flex: 1,
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale },
            ],
          }}
        >
          {/* One loaded image, shifted so the current column is centred. */}
          <Image
            source={{ uri: sheet }}
            cachePolicy="none"
            onLoad={(e) => setAspect(e.source.width / e.source.height)}
            style={{
              position: "absolute",
              top: 0,
              height: box.height,
              width: sheetWidth,
              left: box.width / 2 - ((index + 0.5) * sheetWidth) / angles,
            }}
            accessibilityLabel={`AI 360° preview, angle ${index + 1} of ${angles}`}
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
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: 14,
            alignSelf: "center",
            flexDirection: "row",
            gap: 6,
          }}
        >
          {Array.from({ length: angles }, (_, i) => (
            <View
              key={i}
              style={{
                width: i === index ? 18 : 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: i === index ? colors.ink : colors.white,
              }}
            />
          ))}
        </View>
      </LinearGradient>
    </View>
  );
}
