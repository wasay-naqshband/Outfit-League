import React, { useState } from "react";
import { Linking, View } from "react-native";
import { Body, Button, FlatHeader, Heading, Page } from "../src/components/ui";
export default function Support() {
  const [error, setError] = useState("");
  return (
    <Page>
      <FlatHeader title="Here to help" pill="Support" />
      <View style={{ padding: 20, gap: 16 }}>
        <Heading>Contact Outfit League</Heading>
        <Body>wasayiqbal2@gmail.com</Body>
        <Body>
          Tell us what happened, your device and the screen involved. For an
          account or privacy request, write from your account email. Never send
          passwords, API keys or private photos. We have no published
          response-time guarantee during this test release.
        </Body>
        <Button
          title="Email support"
          onPress={() => {
            void Linking.openURL(
              "mailto:wasayiqbal2@gmail.com?subject=Outfit%20League%20support",
            ).catch(() =>
              setError(
                "Open your email app and write to wasayiqbal2@gmail.com.",
              ),
            );
          }}
        />
        {!!error && <Body>{error}</Body>}
      </View>
    </Page>
  );
}
