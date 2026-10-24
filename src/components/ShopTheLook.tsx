import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Body, Button, Heading } from "./ui";
import { ProductCard } from "./Lookalikes";
import { pieceLink, shopPiece, type OutfitPiece } from "../lib/tryon-api";
import { friendlyError, type TryOnJob } from "../types/tryon";
import { colors, fonts, shadow } from "../theme";

export const PART_LABEL: Record<OutfitPiece["part"], string> = {
  top: "Top",
  layer: "Layer",
  bottoms: "Bottoms",
  shoes: "Shoes",
  accessory: "Extra",
};

// One piece: its name, then up to three store options (closest match,
// cheapest, next closest), each with its real photo, price and Shop.
function PieceOptions({ piece }: { piece: OutfitPiece }) {
  const [opening, setOpening] = useState(-1);
  const [error, setError] = useState("");
  const shop = useQuery({
    queryKey: ["shop-piece", piece.query],
    queryFn: () => shopPiece(piece.query),
    staleTime: Infinity,
    retry: false,
  });
  const items = shop.data?.items ?? [];
  if (!shop.isPending && !items.length) return null;
  const cheapest = Math.min(...items.map((item) => item.price ?? Infinity));
  async function open(index: number) {
    const item = items[index];
    if (opening >= 0 || !item) return;
    setOpening(index);
    setError("");
    try {
      await Linking.openURL((await pieceLink(item)).url);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setOpening(-1);
    }
  }
  return (
    <View style={{ gap: 8 }}>
      <View style={{ gap: 2 }}>
        <Text
          style={{
            fontFamily: fonts.bold,
            fontSize: 11,
            letterSpacing: 1,
            color: colors.text3,
          }}
        >
          {PART_LABEL[piece.part].toUpperCase()}
        </Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 15 }}>
          {piece.name}
        </Text>
      </View>
      {shop.isPending ? (
        <View
          style={{
            height: 120,
            borderRadius: 22,
            backgroundColor: colors.white,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            ...shadow(0.06),
          }}
        >
          <ActivityIndicator color={colors.ink} />
          <Body style={{ fontSize: 13 }}>Finding it in stores…</Body>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
        >
          {items.map((item, i) => (
            <ProductCard
              key={item.url}
              item={item}
              badge={
                i === 0
                  ? "Best match"
                  : item.price === cheapest
                    ? "Cheapest"
                    : null
              }
              busy={opening === i}
              disabled={opening >= 0}
              label="Shop"
              onBuy={() => void open(i)}
            />
          ))}
        </ScrollView>
      )}
      {!!error && <Body style={{ fontSize: 12 }}>{error}</Body>}
    </View>
  );
}

// AI Stylist result: the pieces they own, and real products for the rest.
export function ShopTheLook({
  styled,
}: {
  styled: NonNullable<TryOnJob["styled"]>;
}) {
  const owned = styled.pieces.filter((p) => p.closetId);
  const toShop = styled.pieces.filter((p) => !p.closetId);
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Heading size={22}>Shop the look</Heading>
        <Text style={{ fontSize: 20 }}>🛍️</Text>
      </View>
      {!!styled.title && (
        <Text style={{ fontFamily: fonts.medium, fontSize: 15 }}>
          {styled.title}
        </Text>
      )}
      <Body style={{ fontSize: 14 }}>
        {toShop.length
          ? "Don’t have these pieces? Shop them below, or restyle this look from your own closet."
          : "Every piece here is already in your closet. 🎉"}
      </Body>
      {!!owned.length && (
        <Text
          style={{
            alignSelf: "flex-start",
            overflow: "hidden",
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 6,
            backgroundColor: "#CFF5E4",
            color: "#127A55",
            fontFamily: fonts.bold,
            fontSize: 12,
          }}
        >
          ✓ From your closet: {owned.map((p) => p.name).join(", ")}
        </Text>
      )}
      {!!toShop.length && (
        <View style={{ gap: 20 }}>
          {toShop.map((piece) => (
            <PieceOptions key={piece.part + piece.name} piece={piece} />
          ))}
        </View>
      )}
      {!!toShop.length && (
        <Button
          secondary
          icon="hanger"
          title="Restyle from my closet"
          onPress={() =>
            router.push({
              pathname: "/stylist",
              params: { closet: "1", occasion: styled.request },
            })
          }
        />
      )}
      <Body style={{ fontSize: 11 }}>
        Similar pieces from US stores. Check the store before you buy. We may
        earn a commission from some links.
      </Body>
    </View>
  );
}
