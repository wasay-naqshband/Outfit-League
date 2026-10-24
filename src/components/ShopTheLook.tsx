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

// The best store match for one piece: its real photo, price and Shop.
function PieceCard({ piece }: { piece: OutfitPiece }) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const shop = useQuery({
    queryKey: ["shop-piece", piece.query],
    queryFn: () => shopPiece(piece.query),
    staleTime: Infinity,
    retry: false,
  });
  const item = shop.data?.items[0];
  if (shop.isPending)
    return (
      <View
        style={{
          width: 172,
          height: 330,
          borderRadius: 22,
          backgroundColor: colors.white,
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: 12,
          ...shadow(0.06),
        }}
      >
        <ActivityIndicator color={colors.ink} />
        <Body style={{ fontSize: 13, textAlign: "center" }}>
          Finding {PART_LABEL[piece.part].toLowerCase()}…
        </Body>
      </View>
    );
  if (!item) return null;
  async function open() {
    if (opening || !item) return;
    setOpening(true);
    setError("");
    try {
      await Linking.openURL((await pieceLink(item)).url);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setOpening(false);
    }
  }
  return (
    <View style={{ gap: 6 }}>
      <ProductCard
        item={item}
        badge={PART_LABEL[piece.part]}
        busy={opening}
        disabled={opening}
        label="Shop"
        onBuy={() => void open()}
      />
      {!!error && <Body style={{ fontSize: 12, width: 172 }}>{error}</Body>}
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
        >
          {toShop.map((piece) => (
            <PieceCard key={piece.part + piece.name} piece={piece} />
          ))}
        </ScrollView>
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
