import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Body, Button, FlatHeader, Heading, Page } from "../src/components/ui";
import { Bullets } from "../src/components/Stylist";
import { ProductCard } from "../src/components/Lookalikes";
import { CookingLoader, TRYON_MESSAGES } from "../src/components/CookingLoader";
import { useApp } from "../src/lib/state";
import { useSavedPhoto, useTryOnConfig, useWallet } from "../src/lib/queries";
import { styleLabel, useOnboarding } from "../src/lib/onboarding";
import { agreedOnce } from "../src/lib/consent";
import { outOfCredits } from "../src/lib/credits";
import {
  callTryOn,
  pickOutfit,
  pieceLink,
  shopPiece,
  uploadPhoto,
  type OutfitPick,
  type OutfitPiece,
} from "../src/lib/tryon-api";
import { friendlyError, type JobView } from "../src/types/tryon";
import { colors, fonts, shadow } from "../src/theme";

const OCCASIONS = [
  ["Today ☀️", "An everyday outfit for today"],
  ["Weekend 🛋️", "A relaxed weekend"],
  ["Date night 💕", "A date night"],
  ["Party 🎉", "A party tonight"],
  ["Work 💼", "A day at the office"],
  ["Wedding 💍", "A wedding, as a guest"],
] as const;
const STYLING_MESSAGES = [
  "Reading the room… 👀",
  "Pulling pieces from every rail…",
  "Balancing colours and layers…",
  "Adding the finishing touch ✨",
];
const PART: Record<OutfitPiece["part"], [string, string]> = {
  top: ["👕", "Top"],
  layer: ["🧥", "Layer"],
  bottoms: ["👖", "Bottoms"],
  shoes: ["👟", "Shoes"],
  accessory: ["🧢", "Extra"],
};
const card = {
  backgroundColor: colors.white,
  borderRadius: 28,
  padding: 20,
  gap: 14,
} as const;

// One outfit piece: what it is, and either "in your closet" or real products
// to buy it (Shop the look).
function PieceRow({ piece }: { piece: OutfitPiece }) {
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState(-1);
  const [error, setError] = useState("");
  const shop = useQuery({
    queryKey: ["shop-piece", piece.query],
    queryFn: () => shopPiece(piece.query),
    enabled: open,
    staleTime: Infinity,
    retry: false,
  });
  const [emoji, label] = PART[piece.part];
  async function buy(index: number) {
    const item = shop.data?.items[index];
    if (!item || opening >= 0) return;
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
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.cream,
        paddingTop: 12,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.cream,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 22 }}>{emoji}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              fontFamily: fonts.bold,
              fontSize: 11,
              letterSpacing: 1,
              color: colors.text3,
            }}
          >
            {label.toUpperCase()}
          </Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 15 }}>
            {piece.name}
          </Text>
        </View>
        {piece.closetId ? (
          <Text
            style={{
              overflow: "hidden",
              borderRadius: 12,
              paddingHorizontal: 10,
              paddingVertical: 5,
              backgroundColor: "#CFF5E4",
              color: "#127A55",
              fontFamily: fonts.bold,
              fontSize: 12,
            }}
          >
            ✓ In your closet
          </Text>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Shop ${piece.name}`}
            onPress={() => setOpen((v) => !v)}
            style={{
              borderRadius: 16,
              paddingHorizontal: 14,
              paddingVertical: 8,
              backgroundColor: open ? colors.ink : colors.yellow,
            }}
          >
            <Text
              style={{
                fontFamily: fonts.bold,
                fontSize: 13,
                color: open ? colors.white : colors.ink,
              }}
            >
              {open ? "Hide" : "Shop"}
            </Text>
          </Pressable>
        )}
      </View>
      {open &&
        (shop.isPending ? (
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <ActivityIndicator color={colors.ink} />
            <Body style={{ fontSize: 13 }}>Finding it in stores…</Body>
          </View>
        ) : shop.isError || !shop.data.items.length ? (
          <Body style={{ fontSize: 13 }}>No matches in stores right now.</Body>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
          >
            {shop.data.items.map((item, i) => (
              <ProductCard
                key={item.url}
                item={item}
                badge={i === 0 ? "Cheapest" : null}
                busy={opening === i}
                disabled={opening >= 0}
                onBuy={() => void buy(i)}
              />
            ))}
          </ScrollView>
        ))}
      {!!error && <Body style={{ fontSize: 13 }}>{error}</Body>}
    </View>
  );
}

// AI Stylist: a full outfit for any occasion, shown on the user's own photo.
// Writing the outfit and Shop the look are free; the photo uses 1 credit.
export default function Stylist() {
  const { session } = useApp();
  const client = useQueryClient();
  const styles = useOnboarding().answers.styles.map(styleLabel);
  const saved = useSavedPhoto();
  const wallet = useWallet();
  const config = useTryOnConfig();
  const [occasion, setOccasion] = useState<string>(OCCASIONS[0][1]);
  const [details, setDetails] = useState("");
  const [outfit, setOutfit] = useState<OutfitPick | null>(null);
  const [emptyCloset, setEmptyCloset] = useState(false);
  const [busy, setBusy] = useState<"" | "style" | "closet" | "photo">("");
  const [error, setError] = useState("");
  const startedAt = React.useRef(0);
  const request = details.trim() ? `${occasion}. ${details.trim()}` : occasion;

  async function style(closet: boolean) {
    if (busy) return;
    setBusy(closet ? "closet" : "style");
    setError("");
    setEmptyCloset(false);
    try {
      const result = await pickOutfit(request, styles, closet);
      if (result.emptyCloset) setEmptyCloset(true);
      else setOutfit(result.outfit);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy("");
    }
  }

  async function seeItOnMe() {
    if (busy || !outfit) return;
    if (!saved.data) return router.push("/my-photo");
    if ((wallet.data?.available ?? 0) < 1) return outOfCredits();
    if (!(await agreedOnce(config.data?.provider ?? "the AI provider"))) return;
    startedAt.current = Date.now();
    setBusy("photo");
    setError("");
    try {
      const person = await uploadPhoto(saved.data, "person");
      const description = outfit.pieces
        .map((p) => `${PART[p.part][1]}: ${p.name}`)
        .join(". ");
      const result = await callTryOn<JobView>({
        action: "start",
        key: randomUUID(),
        person,
        outfit: description,
        consent: "tryon-v1",
      });
      await client.invalidateQueries({ queryKey: ["wallet"] });
      await client.invalidateQueries({ queryKey: ["tryon-history"] });
      router.push({
        pathname: "/generation/[id]",
        params: { id: result.job.id, t: String(startedAt.current) },
      });
    } catch (e) {
      if (e instanceof Error && e.message === "NO_CREDITS") outOfCredits();
      else setError(friendlyError(e));
    } finally {
      setBusy("");
    }
  }

  return (
    <Page>
      <Modal
        visible={busy === "photo"}
        animationType="fade"
        statusBarTranslucent
      >
        <CookingLoader
          fullScreen
          messages={TRYON_MESSAGES}
          seconds={25}
          startedAt={startedAt.current}
        />
      </Modal>
      <FlatHeader title="AI Stylist" />
      <View style={{ padding: 20, gap: 18 }}>
        {!session ? (
          <Button
            title="Sign in to meet your stylist"
            onPress={() => router.push("/auth")}
          />
        ) : (
          <>
            <View style={card}>
              <Heading size={24}>What should I wear?</Heading>
              <Body style={{ fontSize: 14 }}>
                Tell me where you’re going. I’ll style a full outfit and show it
                on you.
              </Body>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {OCCASIONS.map(([chip, text]) => (
                  <Pressable
                    key={chip}
                    accessibilityRole="button"
                    accessibilityState={{ selected: occasion === text }}
                    onPress={() => setOccasion(text)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      borderRadius: 18,
                      backgroundColor:
                        occasion === text ? colors.ink : colors.cream,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: fonts.medium,
                        fontSize: 14,
                        color: occasion === text ? colors.white : colors.ink,
                      }}
                    >
                      {chip}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <TextInput
                accessibilityLabel="Details"
                value={details}
                onChangeText={setDetails}
                maxLength={150}
                placeholder="Details? e.g. it’s cold, streetwear vibe"
                placeholderTextColor={colors.placeholder}
                style={{
                  backgroundColor: colors.cream,
                  padding: 14,
                  borderRadius: 16,
                  fontFamily: fonts.body,
                  fontSize: 15,
                  color: colors.ink,
                }}
              />
              <Button
                icon="sparkles"
                title={busy === "style" ? "Styling you…" : "Style me"}
                disabled={!!busy}
                onPress={() => void style(false)}
              />
            </View>

            {(busy === "style" || busy === "closet") && (
              <CookingLoader
                messages={STYLING_MESSAGES}
                seconds={8}
                height={230}
              />
            )}

            {emptyCloset && (
              <View style={card}>
                <Heading size={20}>Your closet is empty</Heading>
                <Body style={{ fontSize: 14 }}>
                  Add the clothes you already own, and I’ll style you from them
                  next time.
                </Body>
                <Button
                  secondary
                  icon="plus"
                  title="Add clothes you own"
                  onPress={() =>
                    router.push({
                      pathname: "/library-edit",
                      params: { kind: "wardrobe" },
                    })
                  }
                />
              </View>
            )}

            {outfit && !busy && (
              <View style={{ ...card, ...shadow(0.06) }}>
                <Heading size={22}>{outfit.title}</Heading>
                <Body style={{ fontSize: 15 }}>{outfit.why}</Body>
                <View style={{ gap: 12 }}>
                  {outfit.pieces.map((piece) => (
                    <PieceRow key={piece.part + piece.name} piece={piece} />
                  ))}
                </View>
                {!!outfit.tips.length && (
                  <View style={{ gap: 8 }}>
                    <Heading size={17}>Styling tips</Heading>
                    <Bullets items={outfit.tips} mark="💡" />
                  </View>
                )}
                <Button
                  icon="sparkles"
                  title={
                    saved.data
                      ? "See it on me · 1 credit"
                      : "Add your photo to see it on you"
                  }
                  onPress={() => void seeItOnMe()}
                />
                <Button
                  secondary
                  icon="hanger"
                  title="Choose from my closet"
                  onPress={() => void style(true)}
                />
                <Text
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 11,
                    color: colors.text3,
                    textAlign: "center",
                  }}
                >
                  Shop links go to the store. We may earn a commission from some
                  links.
                </Text>
              </View>
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
          </>
        )}
      </View>
    </Page>
  );
}
