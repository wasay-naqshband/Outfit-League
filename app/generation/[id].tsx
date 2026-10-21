import React, { useEffect } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Body,
  Button,
  ErrorState,
  FlatHeader,
  Heading,
  Page,
} from "../../src/components/ui";
import { useApp } from "../../src/lib/state";
import {
  CookingLoader,
  TRYON_MESSAGES,
} from "../../src/components/CookingLoader";
import { useJob } from "../../src/lib/queries";
import { friendlyError, isTerminal } from "../../src/types/tryon";
export default function Generation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useApp();
  const query = useJob(id);
  const client = useQueryClient();
  const job = query.data?.job;
  useEffect(() => {
    if (job && isTerminal(job.status)) {
      void client.invalidateQueries({ queryKey: ["wallet"] });
      void client.invalidateQueries({ queryKey: ["tryon-history"] });
      if (job.status === "completed")
        router.replace({ pathname: "/result", params: { job: job.id } });
    }
  }, [job?.status, job?.id, client]);
  return (
    <Page>
      <FlatHeader title="Making your look" pill="Private" />
      <View style={{ padding: 20, gap: 18 }}>
        {!session ? (
          <Button
            title="Sign in to see your try-on"
            onPress={() => router.push("/auth")}
          />
        ) : query.isError ? (
          <ErrorState
            message={friendlyError(query.error)}
            retry={() => {
              void query.refetch();
            }}
          />
        ) : job?.status === "failed" ? (
          <>
            <Heading size={28}>Let’s try another fit.</Heading>
            <Body>
              {friendlyError(new Error(job.error_code ?? "GENERATION_FAILED"))}
            </Body>
            <Button
              title="Choose new photos"
              onPress={() => router.replace("/(tabs)/try-on")}
            />
            <Button
              secondary
              title="View recent try-ons"
              onPress={() => router.push("/history")}
            />
          </>
        ) : (
          <>
            <CookingLoader messages={TRYON_MESSAGES} seconds={25} />
            <Body style={{ fontSize: 13 }}>
              Your credit is reserved while this runs. Failed or timed-out
              generations are refunded automatically. Leaving this screen does
              not cancel a job already sent to the provider.
            </Body>
            <Button
              secondary
              title="Back to Try On"
              onPress={() => router.replace("/(tabs)/try-on")}
            />
          </>
        )}
      </View>
    </Page>
  );
}
