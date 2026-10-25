import React from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Body, Button, Heading, Icon, StickerBadge } from "./ui";
import { garments } from "../lib/explore";
import type { Product } from "../lib/shopping";
import { money } from "../lib/shopping-domain";
import { colors, fonts, gradients, shadow } from "../theme";
export function ProductRow({
  item,
  expanded,
  onPress,
  onRetailer,
  busy,
}: {
  item: Product;
  expanded: boolean;
  onPress: () => void;
  onRetailer: () => void;
  busy: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${item.name}`}
        accessibilityState={{ expanded }}
        onPress={onPress}
        style={{
          minHeight: 100,
          padding: 8,
          paddingRight: 14,
          borderRadius: 24,
          backgroundColor: colors.white,
          flexDirection: "row",
          gap: 12,
          alignItems: "center",
          ...shadow(0.04),
        }}
      >
        <LinearGradient
          colors={gradients[item.palette]}
          style={{
            width: 72,
            height: 84,
            borderRadius: 18,
            borderWidth: 2,
            borderColor: colors.white,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {!item.is_demo && item.image_url ? (
            <Image
              source={{ uri: item.image_url }}
              contentFit="contain"
              style={{ width: "100%", height: "100%" }}
              accessibilityLabel={item.name}
            />
          ) : item.image_key ? (
            <Image
              source={garments[item.image_key]}
              contentFit="contain"
              style={{ width: "100%", height: "100%" }}
              accessibilityLabel="Sample garment illustration"
            />
          ) : (
            <Icon name="hanger" size={32} />
          )}
        </LinearGradient>
        <View style={{ flex: 1, gap: 5 }}>
          <Heading size={17} style={{ letterSpacing: -0.3 }}>
            {item.name}
          </Heading>
          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: 12,
              color: colors.text3,
            }}
          >
            {item.is_test_preview
              ? "Test preview · feed price may have changed"
              : item.is_demo
                ? "Sample catalog · illustrative price"
                : item.retailer_name || "Catalog retailer"}
          </Text>
        </View>
        <Heading size={19}>{money(item.price_minor, item.currency)}</Heading>
      </Pressable>
      {expanded && (
        <View
          style={{
            padding: 16,
            borderRadius: 20,
            backgroundColor: colors.chip,
            gap: 10,
          }}
        >
          <Body>
            {[item.category, item.color, item.brand]
              .filter(Boolean)
              .join(" · ")}
          </Body>
          {item.is_test_preview ? (
            <>
              <StickerBadge size={12}>
                Test preview · not a current offer
              </StickerBadge>
              <Body style={{ fontSize: 13 }}>
                Awin feed snapshot dated {item.feed_updated_at ?? "unknown"}.
                The displayed price may have changed and availability is
                unverified. This direct product link does not use commission
                tracking.
              </Body>
              <Button
                secondary
                disabled={busy || !item.product_url}
                title={busy ? "Opening…" : "Open Ecosusi product"}
                onPress={onRetailer}
              />
            </>
          ) : item.is_demo ? (
            <>
              <StickerBadge size={12}>Demo product</StickerBadge>
              <Body style={{ fontSize: 13 }}>
                Original sample illustration and illustrative {item.currency}{" "}
                price. This is not a purchasable offer. No retailer or
                availability is claimed.
              </Body>
            </>
          ) : (
            <>
              <Body style={{ fontSize: 13 }}>
                Price checked{" "}
                {item.price_checked_at
                  ? new Date(item.price_checked_at).toLocaleString()
                  : "date unavailable"}
                .{" "}
                {item.availability === "in_stock"
                  ? "Catalog reports in stock"
                  : item.availability === "out_of_stock"
                    ? "Catalog reports out of stock"
                    : "Availability unverified"}
                . Confirm the final price, shipping and availability with the
                retailer.
              </Body>
              <Button
                secondary
                disabled={
                  busy ||
                  !item.expires_at ||
                  Date.parse(item.expires_at) <= Date.now() ||
                  item.availability === "out_of_stock"
                }
                title={busy ? "Opening…" : "Open retailer product"}
                onPress={onRetailer}
              />
              <Body style={{ fontSize: 12 }}>
                If an approved affiliate link is available, Outfit League may
                earn a commission. Purchases and checkout happen on the
                retailer’s website.
              </Body>
            </>
          )}
        </View>
      )}
    </View>
  );
}
