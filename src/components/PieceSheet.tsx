import React, { useEffect, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Body, Button, Heading } from "./ui";
import { colors, fonts } from "../theme";

// Bottom sheet for the clothing item: a photo, or a product link from a store.
export function PieceSheet({
  visible,
  busy,
  error,
  onPhoto,
  onLink,
  onClose,
}: {
  visible: boolean;
  busy: boolean;
  error: string;
  onPhoto: () => void;
  onLink: (url: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(""), [visible]);
  const link = url.match(/https?:\/\/\S+/i)?.[0];
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityLabel="Close"
        onPress={busy ? undefined : onClose}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }}
      />
      <View
        style={{
          backgroundColor: colors.cream,
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          padding: 22,
          paddingBottom: 22 + insets.bottom,
          gap: 14,
        }}
      >
        <Heading size={24}>Add a clothing item</Heading>
        <Button
          icon="image"
          title="Choose a photo"
          disabled={busy}
          onPress={onPhoto}
        />
        <Body style={{ textAlign: "center", fontSize: 13 }}>
          or paste a link from any store
        </Body>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.white,
            borderRadius: 18,
            paddingLeft: 16,
          }}
        >
          <TextInput
            accessibilityLabel="Store link"
            value={url}
            onChangeText={setUrl}
            editable={!busy}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="Paste a product page link"
            placeholderTextColor={colors.placeholder}
            style={{
              flex: 1,
              paddingVertical: 15,
              fontFamily: fonts.body,
              fontSize: 15,
              color: colors.ink,
            }}
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void Clipboard.getStringAsync().then(setUrl)}
            style={{ paddingHorizontal: 16, paddingVertical: 15 }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 14 }}>Paste</Text>
          </Pressable>
        </View>
        <Button
          secondary
          icon="sparkles"
          title={busy ? "Finding the item…" : "Use this link"}
          disabled={busy || !link}
          onPress={() => link && onLink(link)}
        />
        {!!error && <Body style={{ fontSize: 14 }}>{error}</Body>}
      </View>
    </Modal>
  );
}
