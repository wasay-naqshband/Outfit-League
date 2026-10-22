import React from "react";
import { View } from "react-native";
import { Body, FlatHeader, Heading, Page } from "../src/components/ui";
export default function Privacy() {
  return (
    <Page>
      <FlatHeader title="Your photos & choices" pill="Privacy" />
      <View style={{ padding: 20, gap: 16 }}>
        <Heading size={25}>Your collection starts private.</Heading>
        <Body>
          Your Closet, uploaded try-on photos, generated looks, credit activity
          and account details are available to your signed-in account. Private
          image links expire; avoid sharing them with others.
        </Body>
        <Heading size={25}>You choose when AI runs.</Heading>
        <Body>
          Only an explicit Generate action, after choosing both images and
          agreeing to the try-on consent, sends your selected photos to the
          configured AI provider. The current provider is Genlook. We request
          short retention and copy completed results into private app storage.
          Tapping “Make 360° view” sends that look’s AI result to Google Gemini
          to make a turning video. The AI Stylist (Rate my fit, Your colours,
          What should I wear?) sends only what you ask about to Google Gemini:
          that look, your saved try-on photo, or your closet item details.
          Pasting or sharing a store link makes our server open that page to
          find the product photo. If you save a try-on photo, it stays privately
          in your account for future try-ons until you delete it in Settings →
          Your try-on photo or delete your account. Browsing or shopping a saved
          look does not run AI.
        </Body>
        <Heading size={25}>Battle images become public by choice.</Heading>
        <Body>
          Sharing a battle is your choice. Only the looks you pick are shared,
          and anyone with the voting link can view them. In a friend battle,
          both players’ names and profile photos are shown with their looks.
          Unpublishing stops new access, but cannot remove screenshots or copies
          someone already saved.
        </Body>
        <Heading size={25}>Anonymous or public votes.</Heading>
        <Body>
          Anonymous voting does not display or store a voter name. Public voting
          requires sign-in, a display name and permission to show that name with
          the chosen fit. Display names are self-chosen. Basic duplicate
          prevention uses an account or browser identifier; clearing browser
          data can bypass guest duplicate prevention.
        </Body>
        <Heading size={25}>Shopping & measurement.</Heading>
        <Body>
          The current catalog is sample data. No payment provider or external
          analytics service is connected. Future approved retailer links may
          record the selected product and whether an affiliate link was used,
          without attaching your private photos or account identity.
        </Body>
        <Heading size={25}>Removing images.</Heading>
        <Body>
          Delete a Closet item or try-on from its detail screen. New access to
          its private photos is blocked and file cleanup is queued. Previously
          downloaded copies cannot be recalled. Account deletion is available in
          Settings → Profile & account controls. It blocks access and removes
          your battle votes, then retries file and account cleanup after issued
          upload links expire (about 2 hours 10 minutes). Existing signed links
          may remain valid for up to five minutes. Provider-held copies are
          subject to the provider’s retention; account deletion cannot recall
          those copies. Contact wasayiqbal2@gmail.com for support or privacy
          requests. Final policy wording still needs review before wider launch.
        </Body>
      </View>
    </Page>
  );
}
