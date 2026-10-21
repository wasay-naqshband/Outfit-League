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
  // `t` is when Try On started showing the loader, so it continues seamlessly.
  const { id, t } = useLocalSearchParams<{ id: string; t?: string }>();
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
  if (session && !query.isError && job?.status !== "failed")
    return (
      <CookingLoader
        fullScreen
        messages={TRYON_MESSAGES}
        seconds={25}
        startedAt={Number(t) || (job ? Date.parse(job.created_at) : undefined)}
        onClose={() => router.replace("/(tabs)/try-on")}
      />
    );
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
        ) : (
          <>
            <Heading size={28}>Let’s try another fit.</Heading>
            <Body>
              {friendlyError(new Error(job?.error_code ?? "GENERATION_FAILED"))}
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
        )}
      </View>
    </Page>
  );
}
