import React from "react";
import { Linking, View } from "react-native";
import { router } from "expo-router";
import { Body, Button, FlatHeader, Heading, Page } from "../src/components/ui";

// Terms of Use (App Store: subscriptions and user-generated content).
export default function Terms() {
  return (
    <Page>
      <FlatHeader title="Terms of Use" pill="Terms" />
      <View style={{ padding: 20, gap: 16 }}>
        <Body>
          By using Outfit League you agree to these terms and to Apple’s
          standard Licensed Application End User License Agreement (EULA). If
          they conflict, these terms apply to the extent allowed.
        </Body>
        <Button
          secondary
          title="Read Apple’s standard EULA"
          onPress={() =>
            void Linking.openURL(
              "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/",
            )
          }
        />
        <Heading size={22}>AI previews</Heading>
        <Body>
          Try-ons, 360° views and AI Stylist outfits are AI-generated previews.
          They show style, not exact fit, size, colour or quality, and can
          contain mistakes. Upload only photos of yourself, or of someone who
          has agreed, and nothing illegal or sexual. You keep the rights to your
          photos and give us permission to process them only to provide the app.
        </Body>
        <Heading size={22}>Pro, credits and payments</Heading>
        <Body>
          Outfit League Pro is an auto-renewing subscription (monthly or yearly)
          with a monthly allowance of try-ons and 360° views. Payment is charged
          to your Apple ID when you confirm. It renews automatically unless
          cancelled at least 24 hours before the end of the current period, and
          your account is charged for renewal within 24 hours before it ends.
          Manage or cancel in your Apple ID settings. A free trial, if offered,
          includes try-ons only; any unused part ends when you subscribe.
          Monthly allowances don’t roll over. Try-on packs are one-time
          purchases and their credits don’t expire. Refunds are handled by
          Apple. A credit is returned automatically if a try-on fails.
        </Body>
        <Heading size={22}>Community rules</Heading>
        <Body>
          Battles and comments are public to anyone with the link. We have zero
          tolerance for objectionable content or abusive users: no hate,
          harassment, threats, sexual content, nudity, violence, spam, or images
          of other people without permission. Offensive words are filtered. You
          can report any battle or comment and block anyone who comments. We
          review reports within 24 hours, remove content that breaks these
          rules, and suspend accounts that do.
        </Body>
        <Heading size={22}>Shopping links</Heading>
        <Body>
          Shop the look and Similar lookalikes link to other stores. Their
          prices, stock and products are theirs, and purchases are between you
          and the store. Some links may earn us a commission at no extra cost to
          you.
        </Body>
        <Heading size={22}>Your account</Heading>
        <Body>
          You can delete your account at any time in Settings. We may suspend
          accounts that break these terms. The app is provided as is, and to the
          extent the law allows we are not liable for indirect losses. These
          terms may change; we’ll show the new version in the app.
        </Body>
        <Heading size={22}>Contact</Heading>
        <Body>Questions or reports: wasayiqbal2@gmail.com</Body>
        <Button
          secondary
          title="How we handle your photos and data"
          onPress={() => router.push("/privacy")}
        />
      </View>
    </Page>
  );
}
