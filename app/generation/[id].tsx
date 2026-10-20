import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import {
  Body,
  Button,
  ErrorState,
  FlatHeader,
  Heading,
  Icon,
  Page,
} from "../../src/components/ui";
import { useApp } from "../../src/lib/state";
import { useJob } from "../../src/lib/queries";
import { friendlyError, isTerminal } from "../../src/types/tryon";
import { colors, gradients } from "../../src/theme";
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
            <LinearGradient
              colors={gradients.lavender}
              style={{
                height: 300,
                borderRadius: 32,
                borderWidth: 4,
                borderColor: colors.white,
                alignItems: "center",
                justifyContent: "center",
                gap: 20,
              }}
            >
              <Icon name="sparkles" size={56} />
              <ActivityIndicator color={colors.ink} size="large" />
            </LinearGradient>
            <Heading size={28}>
              {job?.status === "processing"
                ? "Bringing your fit to life."
                : "Your look is on its way."}
            </Heading>
            <Body>
              {job?.status === "processing"
                ? "The AI provider is generating your preview."
                : job?.status === "submitting" || job?.status === "pending"
                  ? "Preparing your photos for the AI provider."
                  : "Waiting for the AI provider. No need to keep this screen open."}
            </Body>
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
