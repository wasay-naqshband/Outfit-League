import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Body,
  Button,
  EmptyState,
  ErrorState,
  FlatHeader,
  Heading,
  LoadingSkeleton,
  Page,
} from "../src/components/ui";
import { useApp } from "../src/lib/state";
import { useHistory, useJob } from "../src/lib/queries";
import { callTryOn } from "../src/lib/tryon-api";
import { friendlyError, isTerminal } from "../src/types/tryon";
import type { TryOnJob } from "../src/types/tryon";
import { colors } from "../src/theme";

export function HistoryRow({ job }: { job: TryOnJob }) {
  const query = useJob(isTerminal(job.status) ? job.id : undefined);
  const client = useQueryClient();
  const [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function remove() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await callTryOn({ action: "delete", id: job.id });
      client.removeQueries({ queryKey: ["tryon-job", job.owner_id, job.id] });
      await client.invalidateQueries({ queryKey: ["tryon-history"] });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderRadius: 28,
        padding: 14,
        gap: 10,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          job.status === "completed"
            ? "Open your generated look"
            : "Open try-on status"
        }
        onPress={() =>
          router.push(
            job.status === "completed"
              ? { pathname: "/result", params: { job: job.id } }
              : { pathname: "/generation/[id]", params: { id: job.id } },
          )
        }
        style={{
          flexDirection: "row",
          gap: 14,
          alignItems: "center",
          minHeight: 76,
        }}
      >
        {query.data?.afterUrl && (
          <Image
            source={{ uri: query.data.afterUrl }}
            style={{
              width: 72,
              height: 84,
              borderRadius: 18,
              backgroundColor: "#DCD5FF",
            }}
            contentFit="cover"
            cachePolicy="none"
          />
        )}
        <View style={{ flex: 1, gap: 6 }}>
          <Heading size={22}>
            {job.status === "completed"
              ? "Your AI look"
              : job.status === "failed"
                ? "Try-on didn’t finish"
                : "Try-on in progress"}
          </Heading>
          <Body style={{ fontSize: 13 }}>
            {new Date(job.created_at).toLocaleDateString()} ·{" "}
            {query.data?.look?.saved
              ? "Saved privately"
              : job.status === "failed"
                ? "Credit refunded"
                : "Private"}
          </Body>
        </View>
      </Pressable>
      {isTerminal(job.status) &&
        (confirm ? (
          <>
            <Body>
              Delete this look and both source photos? This can’t be undone.
            </Body>
            <Button
              title={busy ? "Deleting…" : "Delete photos and look"}
              disabled={busy}
              onPress={() => {
                void remove();
              }}
            />
            <Button
              secondary
              title="Keep it"
              disabled={busy}
              onPress={() => setConfirm(false)}
            />
          </>
        ) : (
          <Button
            secondary
            title="Delete photos and look"
            onPress={() => setConfirm(true)}
          />
        ))}
      {!!error && <Body>{error}</Body>}
    </View>
  );
}
export default function History() {
  const { session } = useApp(),
    query = useHistory();
  return (
    <Page>
      <FlatHeader title="Recent try-ons" pill="Private" />
      <View style={{ padding: 20, gap: 14 }}>
        {!session ? (
          <EmptyState
            title="Your looks belong to you."
            message="Sign in to reopen your private generated looks."
            action="Sign in"
            onPress={() => router.push("/auth")}
          />
        ) : query.isPending ? (
          <LoadingSkeleton />
        ) : query.isError ? (
          <ErrorState
            message="We couldn’t load your looks. Check your connection and try again."
            retry={() => {
              void query.refetch();
            }}
          />
        ) : !query.data?.length ? (
          <EmptyState
            title="Your next look starts here."
            message="Generate a try-on and it will appear in this private history."
            action="Try a top"
            onPress={() => router.push("/(tabs)/try-on")}
          />
        ) : (
          query.data.map((job) => <HistoryRow key={job.id} job={job} />)
        )}
      </View>
    </Page>
  );
}
