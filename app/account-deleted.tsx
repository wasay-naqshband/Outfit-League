import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Body, Button, FlatHeader, Heading, Page } from "../src/components/ui";
export default function Deleted() {
  return (
    <Page>
      <FlatHeader title="Account deletion" pill="Requested" />
      <View style={{ padding: 20, gap: 16 }}>
        <Heading>Deletion requested.</Heading>
        <Body>
          Your account access is blocked and battles are no longer shared. File
          cleanup starts after about 2 hours 10 minutes and retries
          automatically before the account record is removed. Previously saved
          copies cannot be recalled.
        </Body>
        <Body>
          For help, email wasayiqbal2@gmail.com. Do not include passwords or
          private photos.
        </Body>
        <Button
          title="Return to welcome"
          onPress={() => router.replace("/welcome")}
        />
      </View>
    </Page>
  );
}
